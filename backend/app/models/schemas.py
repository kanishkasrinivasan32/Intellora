from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator

class TopicRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=150)
    difficulty: Literal['beginner', 'intermediate', 'advanced'] = 'beginner'
    count: int = Field(default=5, ge=1, le=12)
    focus_topics: list[str] = Field(default_factory=list, max_length=8)

class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=12000)
    topic: str | None = None
    level: str = 'beginner'

class URLRequest(BaseModel):
    url: str = Field(max_length=2048)
    topic: str = Field(default='General', max_length=150)

class ReferenceLink(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    url: str = Field(pattern=r'^https?://', max_length=2048)

class CardDraft(BaseModel):
    question: str = Field(min_length=3, description='Concept title, not a quiz question')
    answer: str = Field(min_length=50, description='Concise 2-4 sentence concept summary')
    subtopic: str = 'General'
    card_type: str = 'concept'
    importance: str = 'medium'
    explanation: str = Field(min_length=200, description='Detailed teaching explanation')
    key_points: list[str] = Field(min_length=3, max_length=8)
    worked_example: str = Field(min_length=120)
    reference_links: list[ReferenceLink] = Field(default_factory=list, max_length=6)

    @field_validator('key_points', mode='before')
    @classmethod
    def keep_reference_cards_teachable(cls, value):
        """Repair an occasional two-point model response without losing the card."""
        if isinstance(value, list):
            points = [str(point).strip() for point in value if str(point).strip()]
            while len(points) < 3:
                points.append('Connect this idea to the worked example and check it in a new scenario.')
            return points
        return value

class QuestionDraft(BaseModel):
    question: str = Field(min_length=3)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    explanation: str
    concept: str = 'General'
    difficulty: Literal['beginner', 'intermediate', 'advanced'] = 'beginner'
    @model_validator(mode='after')
    def check_index(self):
        if self.correct_index >= len(self.options): raise ValueError('Answer index out of bounds')
        return self

class LessonDraft(BaseModel):
    title: str
    content: str = Field(min_length=50)

class HierarchyNode(BaseModel):
    name: str = Field(min_length=1)
    prerequisites: list[str] = Field(default_factory=list)

class CourseDraft(BaseModel):
    title: str
    description: str
    hierarchy: list[HierarchyNode]
    lessons: list[LessonDraft] = Field(min_length=1, max_length=12)
    flashcards: list[CardDraft] = Field(min_length=1)
    questions: list[QuestionDraft] = Field(min_length=1)

class CoursePlanLesson(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    module: str = Field(min_length=2, max_length=120)
    objective: str = Field(min_length=10, max_length=500)
    prerequisites: list[str] = Field(default_factory=list)

class CoursePlan(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=20, max_length=1200)
    lessons: list[CoursePlanLesson] = Field(min_length=8, max_length=20)

class CompleteLessonDraft(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    objective: str = Field(min_length=10)
    content: str = Field(min_length=3500)
    worked_example: str = Field(min_length=500)
    practice_exercises: list[str] = Field(min_length=2, max_length=5)
    source_chunk_ids: list[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def substantial_content(self):
        if len((self.content + ' ' + self.worked_example).split()) < 650:
            raise ValueError('A lesson must contain at least 650 words including its worked example')
        return self

class FlashcardBatch(BaseModel):
    cards: list[CardDraft] = Field(min_length=5, max_length=8)

class QuizBatch(BaseModel):
    questions: list[QuestionDraft] = Field(min_length=5, max_length=8)

class CoverageAudit(BaseModel):
    missing_subtopics: list[str] = Field(default_factory=list, max_length=5)
    is_complete: bool

    @model_validator(mode='after')
    def consistent_result(self):
        if not self.is_complete and not self.missing_subtopics:
            raise ValueError('An incomplete audit must name at least one missing subtopic')
        return self

class CardAnswer(BaseModel):
    correct: bool

class CardEdit(BaseModel):
    question: str = Field(min_length=3, max_length=5000)
    answer: str = Field(min_length=1, max_length=20000)
    explanation: str = Field(default='', max_length=40000)
    worked_example: str = Field(default='', max_length=20000)
    key_points: list[str] = Field(default_factory=list, max_length=12)

class DiagramNode(BaseModel):
    id: str
    label: str = Field(max_length=200)

class DiagramEdge(BaseModel):
    from_: str = Field(alias='from')
    to: str
    label: str = ''

class Diagram(BaseModel):
    title: str
    nodes: list[DiagramNode] = Field(min_length=1, max_length=30)
    edges: list[DiagramEdge] = Field(max_length=100)
    @model_validator(mode='after')
    def linked_nodes(self):
        ids = {n.id for n in self.nodes}
        if len(ids) != len(self.nodes) or any(e.from_ not in ids or e.to not in ids for e in self.edges):
            raise ValueError('Invalid diagram links')
        return self

class QuizSubmission(BaseModel):
    answers: dict[str, int]

class ModelsRequest(BaseModel):
    provider: Literal['auto', 'ollama', 'gemini', 'sarvam', 'openrouter', 'groq']
    models: dict[str, str]
    api_keys: dict[str, str] = Field(default_factory=dict)
    cloud_models: dict[str, str] = Field(default_factory=dict)

class NoteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(max_length=100000)
    topic: str = Field(default='General', min_length=1, max_length=150)
