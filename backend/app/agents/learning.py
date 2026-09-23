import json
from urllib.parse import quote_plus
from sqlalchemy import select
from pydantic import ValidationError
from app.models.entities import Course, Lesson, Flashcard, Quiz, QuizQuestion, Topic, Progress, Chunk, Source
from app.models.schemas import CardDraft, QuestionDraft, CourseDraft
from app.services.llm_service import generate_json, ProviderError
from app.rag.vector_store import search

CARD = {'question': 'Concept title', 'answer': 'Clear 2-4 sentence overview', 'subtopic': 'Specific subtopic',
        'card_type': 'concept', 'importance': 'high', 'explanation': 'Detailed explanation in 2-4 paragraphs',
        'key_points': ['Key point 1', 'Key point 2', 'Key point 3'], 'worked_example': 'Concrete worked example',
        'reference_links': [{'title': 'Source title', 'url': 'https://example.com'}]}
QUESTION = {'question': '...', 'options': ['A', 'B', 'C', 'D'], 'correct_index': 0, 'explanation': '...', 'concept': '...', 'difficulty': 'beginner'}


def default_reference_links(topic, subtopic):
    """Return a useful documentation search when generation has no cited source."""
    subject = (subtopic or topic or 'learning topic').strip()
    query = quote_plus(subject)
    normalized = (topic or '').strip().lower()
    if normalized == 'aws' or normalized.startswith('amazon web services'):
        return [{'title': f'Official AWS documentation: {subject}',
                 'url': f'https://docs.aws.amazon.com/search/doc-search.html?searchPath=documentation&searchQuery={query}'}]
    if normalized in {'machine learning', 'ml'}:
        return [{'title': f'Scikit-learn guide: {subject}',
                 'url': f'https://scikit-learn.org/stable/search.html?q={query}'}]
    if normalized == 'python':
        return [{'title': f'Python documentation: {subject}',
                 'url': f'https://docs.python.org/3/search.html?q={query}'}]
    if normalized == 'sql':
        return [{'title': f'PostgreSQL documentation: {subject}',
                 'url': f'https://www.postgresql.org/search/?q={query}'}]
    return [{'title': f'Read more: {subject}',
             'url': f'https://en.wikipedia.org/wiki/Special:Search?search={query}'}]

def context_for(topic):
    chunks = search(topic, topic=topic, limit=8)
    context = '\n\n'.join(f'[{c["id"]}] {c["content"]}' for c in chunks)
    return chunks, context or 'No uploaded source for this topic. Use established general knowledge and do not invent source citations.'

def validate(cls, data):
    try: return cls.model_validate(data)
    except ValidationError: raise ProviderError('The model returned incomplete or invalid content. Please generate again.') from None

def add_cards(db, drafts, topic, difficulty, ids, course_id=None):
    source_links = []
    if ids:
        rows = db.execute(select(Source.title, Source.url).join(Chunk, Chunk.source_id == Source.id).where(Chunk.id.in_(ids))).all()
        source_links = [{'title': title, 'url': url} for title, url in rows if url]
    cards = []
    for draft in drafts:
        data = draft.model_dump()
        supplied = [link for link in data.pop('reference_links', []) if str(link.get('url', '')).startswith(('http://', 'https://'))]
        links = list({link['url']: link for link in [*source_links, *supplied]}.values())[:6]
        if not links:
            links = default_reference_links(topic, data.get('subtopic') or data.get('question'))
        cards.append(Flashcard(**data, reference_links=links, topic=topic, difficulty=difficulty,
                               source_chunk_ids=ids, course_id=course_id))
    db.add_all(cards); db.flush()
    return cards

def add_quiz(db, drafts, topic, ids, course_id=None):
    quiz = Quiz(topic=topic, title=f'{topic} · Knowledge challenge', course_id=course_id)
    db.add(quiz); db.flush()
    db.add_all([QuizQuestion(quiz_id=quiz.id, source_chunk_ids=ids, **x.model_dump()) for x in drafts]); db.flush()
    return quiz

def generate_cards(db, request):
    chunks, context = context_for(request.topic)
    focus = ', '.join(request.focus_topics) or 'Choose distinct, specific subtopics that provide broad coverage.'
    raw = generate_json(
        f'Create {request.count} rich learning reference cards about {request.topic}, level {request.difficulty}. '
        f'These are NOT quiz questions. Each question field is a short concept TITLE. Each card must teach one '
        f'specific subtopic using a useful overview, detailed explanation, 3-6 key points, a concrete worked example, '
        f'and relevant reference links when present in the source material. Requested focus topics: {focus}. '
        f'Source material:\n{context}', {'cards': [CARD]}, 'flashcards')
    if not isinstance(raw, dict) or not isinstance(raw.get('cards'), list) or not raw['cards']: raise ProviderError('No valid flashcards returned. Retry generation.')
    drafts = [validate(CardDraft, x) for x in raw['cards'][:request.count]]
    cards = add_cards(db, drafts, request.topic, request.difficulty, [c['id'] for c in chunks]); db.commit()
    return cards

def generate_quiz(db, request):
    chunks, context = context_for(request.topic)
    progress = db.scalar(select(Progress).where(Progress.topic == request.topic))
    weak = progress.weak_concepts if progress else []
    raw = generate_json(f'Create {request.count} multiple-choice questions about {request.topic}. Mix difficulties around {request.difficulty}. Weight weak concepts: {weak}. Each question has one correct answer. Sources:\n{context}', {'questions': [QUESTION]}, 'quiz')
    if not isinstance(raw, dict) or not isinstance(raw.get('questions'), list) or not raw['questions']: raise ProviderError('No valid quiz returned. Retry generation.')
    quiz = add_quiz(db, [validate(QuestionDraft, x) for x in raw['questions'][:request.count]], request.topic, [c['id'] for c in chunks]); db.commit()
    return quiz

def generate_course(db, request):
    chunks, context = context_for(request.topic)
    schema = {'title': '...', 'description': '...', 'hierarchy': [{'name': 'Concept', 'prerequisites': []}], 'lessons': [{'title': '...', 'content': 'Full Markdown lesson with explanation, worked example, and practice exercise'}], 'flashcards': [CARD], 'questions': [QUESTION]}
    raw = generate_json(f'Design a compact {request.difficulty} course on {request.topic}: 3 substantial complete lessons (200-350 words each), 4 flashcards and 4 quiz questions. Organize prerequisites to core concepts to application and evaluation. Include 4-7 hierarchy nodes with prerequisites naming earlier nodes. Sources:\n{context}', schema, 'course')
    draft = validate(CourseDraft, raw)
    ids = [c['id'] for c in chunks]
    course = Course(title=draft.title, topic=request.topic, description=draft.description, difficulty=request.difficulty)
    db.add(course); db.flush()
    db.add_all([Lesson(course_id=course.id, title=x.title, content=x.content, position=i, source_chunk_ids=ids) for i,x in enumerate(draft.lessons)])
    add_cards(db, draft.flashcards, request.topic, request.difficulty, ids, course.id)
    add_quiz(db, draft.questions, request.topic, ids, course.id)
    topic = db.scalar(select(Topic).where(Topic.name == request.topic))
    if not topic: topic = Topic(name=request.topic); db.add(topic)
    topic.hierarchy = [node.model_dump() for node in draft.hierarchy]
    db.commit()
    return course
