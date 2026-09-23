"""Slow, staged, fault-tolerant course generation.

The UI intentionally treats this as a background voyage: planning, optional
research, and every lesson/practice pack are separate validated model calls.
"""
from datetime import datetime, timezone
import re
from sqlalchemy import delete, select

from app.agents.learning import CARD, QUESTION, add_cards, add_quiz
from app.agents.research import find_sources
from app.database.session import Session, current_user_id
from app.ingestion.pipeline import process_source
from app.models.entities import (
    Course, CourseGenerationJob, Flashcard, Lesson, Quiz, QuizQuestion,
    Source, Topic, UserAnswer,
)
from app.models.schemas import (
    CardDraft, CompleteLessonDraft, CoursePlan, CoursePlanLesson, CoverageAudit,
    FlashcardBatch, QuestionDraft, QuizBatch,
)
from app.rag.vector_store import search
from app.services.llm_service import GenerationError, generate, generate_validated, runtime


PLAN_SYSTEM = (
    "You are Intellora's Knowledge Architect. Design a complete, ordered course, not a short overview. "
    "Break prerequisites, foundations, core methods, evaluation, practical workflow, failure modes, and "
    "real applications into 8-20 focused lessons. A broad subject such as Machine Learning normally needs "
    "12-18 lessons. Each lesson must teach one coherent unit and name only earlier prerequisites."
)
LESSON_SYSTEM = (
    "You are Intellora's expert tutor writing exactly one self-contained lesson. Explain the core idea, why "
    "it exists, how it works step by step, important trade-offs and common mistakes. Include a fully worked "
    "numeric or code example where appropriate and 2-5 useful practice exercises. The explanation plus worked "
    "example must be 600-1200 words when the subject warrants it and never under 300 words. Use clear Markdown. "
    "Use retrieved sources when supplied; when they are absent, use stable established knowledge and never invent citations."
)
LONG_FORM_LESSON_SYSTEM = (
    "You are Intellora's senior course author. Write one rigorous, self-contained textbook lesson in Markdown. Write inline mathematics as $...$ and display equations as $$...$$ using valid LaTeX. "
    "Return prose only, never JSON and never a surrounding code fence. Aim for 1,000-1,500 words of useful "
    "teaching. Use descriptive headings and cover the conceptual foundation, step-by-step mechanics, practical "
    "workflow, trade-offs, common mistakes, debugging, and a fully worked numeric or code example. Finish with "
    "three progressively harder practice exercises. Be specific to the requested lesson and do not pad or repeat."
)
FLASHCARD_SYSTEM = (
    "Create 5-8 rich learning reference cards for one lesson, not quiz questions. The question field is a concise "
    "concept title. Every card must include a 2-4 sentence overview, a detailed explanation, 3-6 key points, a "
    "concrete worked example, and source/reference links when available. Use specific subtopics and avoid duplicates."
)
QUIZ_SYSTEM = (
    "Create 5-8 multiple-choice questions for one lesson with exactly one correct option. Mix recall, reasoning, "
    "worked application and at least one scenario question. Explanations must teach why the answer is correct."
)
AUDIT_SYSTEM = (
    "You are a strict course coverage auditor. Compare the topic with the lesson titles and objectives. Name only "
    "important, specific gaps that prevent a learner from reaching practical mastery. Return at most five gaps."
)


def _log(db, job, message, *, status=None, current=None, total=None):
    job.log = [*(job.log or []), {'ts': datetime.now(timezone.utc).isoformat(), 'message': message}]
    if status is not None:
        job.status = status
    if current is not None:
        job.progress_current = current
    if total is not None:
        job.progress_total = total
    db.commit()


def _research(db, job):
    """Bring several public sources into the existing ingestion/RAG pipeline."""
    try:
        found = find_sources(job.topic, limit=5)
    except ValueError as exc:
        _log(db, job, f'Public research was unavailable ({exc}). Continuing with your library and established knowledge.')
        return
    source_ids = []
    for result in found:
        existing = db.scalar(select(Source).where(Source.url == result['url'], Source.topic == job.topic))
        if existing:
            source_ids.append(existing.id)
            continue
        source = Source(**result, topic=job.topic, file_type='website')
        db.add(source)
        db.flush()
        source_ids.append(source.id)
    db.commit()
    for index, source_id in enumerate(source_ids, 1):
        process_source(source_id, job.user_id)
        _log(db, job, f'Scouted and indexed source {index} of {len(source_ids)}.')


def _context(topic, lesson_title):
    chunks = search(lesson_title, topic=topic, limit=8)
    text = '\n\n'.join(f'[{row["id"]}] {row["content"]}' for row in chunks)
    return chunks, text or 'No retrieved passages were available for this lesson.'


def _plain_long_form_lesson(db, job, planned, context):
    """Avoid putting a long Markdown lesson inside JSON when a model struggles."""
    _log(db, job, f'Using the long-form writer for {planned.title} so depth is preserved.')
    base_prompt = (
        f'Course topic: {job.topic}\nLearner level: {job.level}\nLesson: {planned.title}\n'
        f'Learning objective: {planned.objective}\nPrerequisites: {planned.prerequisites}\n\n'
        f'Retrieved context (use when relevant; do not invent citations):\n{context}\n\n'
        'Write the complete lesson now. Include at least one concrete worked example and three practice exercises.'
    )
    body = generate(base_prompt, LONG_FORM_LESSON_SYSTEM, 'course', json_mode=False).strip()
    if body.startswith('```'):
        body = body.split('\n', 1)[1].rsplit('```', 1)[0].strip()
    if len(body) < 4500 or len(body.split()) < 750:
        supplement = generate(
            base_prompt + '\n\nWrite a non-overlapping deep-dive supplement of 500-800 words focused on '
            'implementation details, trade-offs, failure diagnosis, and an additional worked example.',
            LONG_FORM_LESSON_SYSTEM,
            'course',
            json_mode=False,
        ).strip()
        body = f'{body}\n\n## Deeper practice and failure analysis\n\n{supplement}'
    if len(body) < 3500 or len(body.split()) < 650:
        raise GenerationError(
            f'The long-form writer returned only {len(body)} characters and {len(body.split())} words for {planned.title}.'
        )
    return (
        planned.title,
        f'> **Learning objective:** {planned.objective}\n\n{body}',
    )


def _discard_course_draft(db, course_id):
    """Remove an incomplete draft and every learning artifact it created."""
    quiz_ids = list(db.scalars(select(Quiz.id).where(Quiz.course_id == course_id)))
    question_ids = list(db.scalars(select(QuizQuestion.id).where(QuizQuestion.quiz_id.in_(quiz_ids)))) if quiz_ids else []
    card_ids = list(db.scalars(select(Flashcard.id).where(Flashcard.course_id == course_id)))
    artifact_ids = [*card_ids, *question_ids]
    if artifact_ids:
        db.execute(delete(UserAnswer).where(UserAnswer.item_id.in_(artifact_ids)))
    if question_ids:
        db.execute(delete(QuizQuestion).where(QuizQuestion.id.in_(question_ids)))
    if quiz_ids:
        db.execute(delete(Quiz).where(Quiz.id.in_(quiz_ids)))
    db.execute(delete(Flashcard).where(Flashcard.course_id == course_id))
    db.execute(delete(Lesson).where(Lesson.course_id == course_id))
    db.execute(delete(Course).where(Course.id == course_id))


def _fallback_cards(title, content):
    """Build five substantial, lesson-specific references from Markdown sections."""
    lines = content.splitlines()
    headings = []
    for index, line in enumerate(lines):
        match = re.match(r'^(#{2,4})\s+(.+?)\s*$', line)
        if match:
            headings.append((index, len(match.group(1)), re.sub(r'[*_`]', '', match.group(2)).strip()))
    sections = []
    for section_index, (start, level, heading) in enumerate(headings):
        end = next((line_index for line_index, next_level, _ in headings[section_index + 1:]
                    if next_level <= level), len(lines))
        body = '\n'.join(lines[start + 1:end]).strip()
        if len(body) >= 250 and heading.lower() not in {'practice exercises', 'exercises', 'references'}:
            sections.append((heading, body))
    unique_sections = []
    seen_headings = set()
    for heading, body in sections:
        key = heading.lower()
        if key not in seen_headings:
            unique_sections.append((heading, body))
            seen_headings.add(key)
    sections = unique_sections
    generic = {
        'overview', 'introduction', 'concepts', 'example', 'worked example', 'practical workflow',
        'common mistakes', 'common mistakes and debugging', 'debugging', 'conclusion', 'summary',
    }
    specific = [item for item in sections if item[0].lower() not in generic]
    sections = [*specific, *[item for item in sections if item not in specific]]
    paragraphs = [part.strip() for part in re.split(r'\n\s*\n', content) if len(part.split()) >= 25]
    while len(sections) < 5:
        index = len(sections)
        body = paragraphs[index % len(paragraphs)] if paragraphs else content
        sections.append((f'Applied concept {index + 1}', body))
    example_source = next(
        (paragraph for paragraph in paragraphs
         if re.search(r'\b(for example|suppose|consider|scenario|imagine|worked example)\b', paragraph, re.I)),
        paragraphs[0] if paragraphs else content,
    )
    cards = []
    for heading, body in sections[:5]:
        concept = heading if heading.lower() == title.lower() else f'{title}: {heading}'
        subtopic = f'{title} · {heading}' if heading.lower() != title.lower() else title
        evidence = re.sub(r'^>\s*', '', body).strip()
        plain_sentences = [
            re.sub(r'\s+', ' ', re.sub(r'[`*_>#-]', '', sentence)).strip()
            for sentence in re.split(r'(?<=[.!?])\s+', evidence)
            if len(re.sub(r'[`*_>#-]', '', sentence).strip()) > 25
        ]
        answer = ' '.join(plain_sentences[:3])[:700].strip()
        if len(answer) < 80:
            answer = re.sub(r'\s+', ' ', re.sub(r'[`*_>#-]', '', evidence))[:700].strip()
        explanation = evidence[:2200]
        if len(explanation) < 250:
            explanation = f'{explanation}\n\n{example_source[:900]}'.strip()
        bullets = []
        for line in evidence.splitlines():
            clean = re.sub(r'^\s*(?:[-*]|\d+[.)])\s*', '', line).strip()
            if 35 <= len(clean) <= 260:
                bullets.append(clean)
        key_points = list(dict.fromkeys([*bullets, *plain_sentences]))[:6]
        while len(key_points) < 3:
            key_points.append(f'Connect {heading} to the worked example and the objective of {title}.')
        example = next(
            (paragraph for paragraph in re.split(r'\n\s*\n', evidence)
             if re.search(r'\b(for example|suppose|consider|scenario|imagine)\b|```', paragraph, re.I)),
            example_source,
        )
        if len(example) < 120:
            example = f'Apply **{heading}** in this situation:\n\n{example}\n\nTrace the inputs, the decision, and the expected output.'
        cards.append(CardDraft(
            question=concept[:500], answer=answer, subtopic=subtopic[:180], card_type='concept',
            explanation=explanation, key_points=key_points[:8], worked_example=example[:1800],
        ))
    return FlashcardBatch(cards=cards)


def _contextualize_cards(cards, lesson_title):
    """Keep model-authored cards specific even when the model uses generic headings."""
    generic = {
        'overview', 'introduction', 'concepts', 'example', 'worked example', 'practical workflow',
        'common mistakes', 'common mistakes and debugging', 'debugging', 'conclusion', 'summary',
    }
    seen = set()
    for card in cards:
        title = card.question.strip()
        if title.lower() in generic or title.lower() in seen:
            card.question = f'{lesson_title}: {title}'
        seen.add(card.question.lower())
        if (card.subtopic or '').strip().lower() in generic:
            card.subtopic = f'{lesson_title} · {card.subtopic.strip()}'
    return cards


def _fallback_quiz(title, content):
    headings = re.findall(r'^#{2,4}\s+(.+?)\s*$', content, flags=re.MULTILINE)
    concepts = []
    for heading in headings:
        clean = re.sub(r'[*_`]', '', heading).strip()
        if clean and clean.lower() not in {item.lower() for item in concepts}:
            concepts.append(clean)
    concepts.extend([f'{title} fundamentals', f'{title} workflow', f'{title} trade-offs'])
    while len(concepts) < 5:
        concepts.append(f'{title} practice checkpoint {len(concepts) + 1}')
    questions = []
    for index in range(5):
        concept = concepts[index]
        questions.append(QuestionDraft(
            question=f'Which concept is explicitly developed in this {title} lesson?',
            options=[concept, 'An unrelated deployment detail', 'A random database schema', 'A non-existent shortcut'],
            correct_index=0,
            explanation=f'{concept} is one of the lesson sections and should be connected to the worked example.',
            concept=concept[:180], difficulty='intermediate',
        ))
    return QuizBatch(questions=questions)


def _write_lesson(db, job, course, planned, position):
    chunks, context = _context(job.topic, planned.title)
    try:
        artifact = generate_validated(
            CompleteLessonDraft,
            f'Course topic: {job.topic}\nLearner level: {job.level}\nLesson title: {planned.title}\n'
            f'Objective: {planned.objective}\nPrerequisites: {planned.prerequisites}\n\nRetrieved context:\n{context}',
            LESSON_SYSTEM,
            'course',
            max_retries=1,
        )
        practice = '\n'.join(f'{i}. {item}' for i, item in enumerate(artifact.practice_exercises, 1))
        title = artifact.title
        content = (
            f'> **Learning objective:** {artifact.objective}\n\n{artifact.content.strip()}\n\n'
            f'## Worked example\n\n{artifact.worked_example.strip()}\n\n## Practice exercises\n\n{practice}'
        )
    except GenerationError:
        title, content = _plain_long_form_lesson(db, job, planned, context)
    source_ids = [row['id'] for row in chunks]
    lesson = Lesson(course_id=course.id, title=title, content=content,
                    position=position, source_chunk_ids=source_ids)
    db.add(lesson)
    db.flush()

    try:
        cards = generate_validated(
            FlashcardBatch,
            f'Lesson title: {title}\nLesson content:\n{content}',
            FLASHCARD_SYSTEM,
            'flashcards',
            max_retries=1,
        )
    except GenerationError:
        _log(db, job, f'Flashcard model returned an incomplete batch for {title}; deriving five references from the lesson.')
        cards = _fallback_cards(title, content)
    add_cards(db, _contextualize_cards(cards.cards, title), job.topic, job.level, source_ids, course.id)
    try:
        questions = generate_validated(
            QuizBatch,
            f'Lesson title: {title}\nLesson content:\n{content}\nUse learner level {job.level}.',
            QUIZ_SYSTEM,
            'quiz',
            max_retries=1,
        )
    except GenerationError:
        _log(db, job, f'Quiz model returned an incomplete batch for {title}; deriving five checks from the lesson.')
        questions = _fallback_quiz(title, content)
    quiz = add_quiz(db, questions.questions, job.topic, source_ids, course.id)
    quiz.title = f'{title} · Lesson challenge'
    db.commit()
    return lesson


def run_course_generation(job_id: str, user_id: str):
    token = current_user_id.set(user_id)
    try:
        with Session(user_id=user_id) as db:
            job = db.get(CourseGenerationJob, job_id)
            if not job:
                return
            try:
                model_names = [runtime['models'][name] for name in ('course', 'flashcards', 'quiz')]
                _log(db, job, f'Preparing the course, flashcard and quiz models: {", ".join(dict.fromkeys(model_names))}.', status='researching')
                _research(db, job)

                _log(db, job, 'Building a complete syllabus and prerequisite path.', status='building_hierarchy')
                plan = generate_validated(
                    CoursePlan,
                    f'Topic: {job.topic}\nLearner level: {job.level}\nCreate the full course plan.',
                    PLAN_SYSTEM,
                    'course',
                )
                course = Course(
                    title=plan.title, topic=job.topic, description=plan.description,
                    difficulty=job.level, status='draft',
                )
                db.add(course)
                db.flush()
                job.course_id = course.id
                topic = db.scalar(select(Topic).where(Topic.name == job.topic))
                if not topic:
                    topic = Topic(name=job.topic)
                    db.add(topic)
                topic.hierarchy = [
                    {'name': item.title, 'module': item.module, 'objective': item.objective,
                     'prerequisites': item.prerequisites}
                    for item in plan.lessons
                ]
                db.commit()

                lessons = list(plan.lessons)
                _log(db, job, f'Syllabus approved with {len(lessons)} substantive lessons.',
                     status='writing_lessons', current=0, total=len(lessons))
                completed = 0
                failed_lessons = []
                for index, planned in enumerate(lessons):
                    try:
                        _write_lesson(db, job, course, planned, index)
                        completed += 1
                        _log(db, job, f'Logged lesson {index + 1} of {len(lessons)}: {planned.title}', current=index + 1)
                    except Exception as exc:
                        db.rollback()
                        failed_lessons.append((index, planned))
                        job = db.get(CourseGenerationJob, job_id)
                        course = db.get(Course, job.course_id)
                        _log(db, job, f'Lesson {index + 1} needs another pass and was skipped: {str(exc)[:220]}', current=index + 1)

                unresolved = []
                for position, planned in failed_lessons:
                    try:
                        _log(db, job, f'Retrying the complete lesson pack for {planned.title}.')
                        _write_lesson(db, job, course, planned, position)
                        completed += 1
                        _log(db, job, f'Recovered required lesson: {planned.title}')
                    except Exception as exc:
                        db.rollback()
                        unresolved.append(planned.title)
                        job = db.get(CourseGenerationJob, job_id)
                        course = db.get(Course, job.course_id)
                        _log(db, job, f'Required lesson still could not be completed: {planned.title} ({str(exc)[:180]})')

                if completed == 0 or unresolved:
                    detail = ', '.join(unresolved) if unresolved else 'all planned lessons'
                    raise GenerationError(f'The complete course could not be published because these lessons are unfinished: {detail}')

                _log(db, job, 'Auditing the full learning path for missing essentials.', status='auditing')
                saved = list(db.scalars(select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.position)))
                audit = generate_validated(
                    CoverageAudit,
                    f'Topic: {job.topic}\nLearner level: {job.level}\nGenerated lessons:\n' +
                    '\n'.join(f'- {item.title}' for item in saved),
                    AUDIT_SYSTEM,
                    'course',
                )
                unresolved_gaps = []
                for gap in dict.fromkeys(audit.missing_subtopics):
                    planned = CoursePlanLesson(
                        title=gap, module='Coverage gaps',
                        objective=f'Understand and apply {gap} within {job.topic}.', prerequisites=[]
                    )
                    try:
                        next_position = max((item.position for item in saved), default=-1) + 1
                        _write_lesson(db, job, course, planned, next_position)
                        saved = list(db.scalars(select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.position)))
                        _log(db, job, f'Filled coverage gap: {gap}', total=len(saved), current=len(saved))
                    except Exception as exc:
                        db.rollback()
                        unresolved_gaps.append(gap)
                        job = db.get(CourseGenerationJob, job_id)
                        course = db.get(Course, job.course_id)
                        _log(db, job, f'Coverage gap could not be completed: {gap} ({str(exc)[:180]})')

                if unresolved_gaps:
                    raise GenerationError(
                        'The complete course could not be published because these coverage gaps are unfinished: '
                        + ', '.join(unresolved_gaps)
                    )
                final_count = len(list(db.scalars(select(Lesson).where(Lesson.course_id == course.id))))
                course.status = 'ready'
                db.commit()
                _log(db, job, f'Course complete: {final_count} lessons, with flashcards and a quiz for every completed lesson.',
                     status='done', current=final_count, total=final_count)
            except Exception as exc:
                db.rollback()
                job = db.get(CourseGenerationJob, job_id)
                if job:
                    draft_id = job.course_id
                    if draft_id:
                        _discard_course_draft(db, draft_id)
                        job.course_id = None
                    job.status = 'failed'
                    job.error = str(exc)[:1000]
                    job.log = [
                        *(job.log or []),
                        {'message': 'The incomplete draft was discarded; it was never published to your courses.'},
                        {'message': f'Generation stopped: {job.error}'},
                    ]
                    db.commit()
    finally:
        current_user_id.reset(token)
