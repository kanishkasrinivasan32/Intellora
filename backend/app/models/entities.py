from datetime import datetime, timezone, date
from uuid import uuid4
from sqlalchemy import Column, String, Text, Integer, Float, JSON, DateTime, Date, Boolean, ForeignKey, UniqueConstraint
from app.database.session import Base, TenantOwned

def uid(): return uuid4().hex
def now(): return datetime.now()

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, default='kanishka')
    name = Column(String, default='Kanishka')
    username = Column(String(40), nullable=True, unique=True)
    email = Column(String(320), nullable=True, unique=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=now)
    is_admin = Column(Boolean, nullable=False, default=False)
    avatar_filename = Column(String, nullable=True)
    profile_completed = Column(Boolean, nullable=False, default=False)

class Topic(TenantOwned, Base):
    __tablename__ = 'topics'
    __table_args__ = (UniqueConstraint('user_id', 'name'),)
    id = Column(String, primary_key=True, default=uid)
    name = Column(String)
    hierarchy = Column(JSON, default=list)

class Source(TenantOwned, Base):
    __tablename__ = 'sources'
    id = Column(String, primary_key=True, default=uid)
    title = Column(String)
    file_type = Column(String)
    topic = Column(String, default='General', index=True)
    url = Column(String, nullable=True)
    path = Column(String, nullable=True)
    status = Column(String, default='processing')
    error = Column(Text, nullable=True)
    chunks = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)

class Document(TenantOwned, Base):
    __tablename__ = 'documents'
    id = Column(String, primary_key=True, default=uid)
    source_id = Column(String, ForeignKey('sources.id', ondelete='CASCADE'), index=True)
    title = Column(String)
    content = Column(Text)
    file_type = Column(String)
    topic = Column(String)
    details = Column(JSON, default=dict)

class Chunk(TenantOwned, Base):
    __tablename__ = 'chunks_meta'
    id = Column(String, primary_key=True, default=uid)
    source_id = Column(String, ForeignKey('sources.id', ondelete='CASCADE'), index=True)
    topic = Column(String, index=True)
    content = Column(Text)
    position = Column(Integer)
    difficulty = Column(String, default='beginner')

class Course(TenantOwned, Base):
    __tablename__ = 'courses'
    id = Column(String, primary_key=True, default=uid)
    title = Column(String)
    topic = Column(String, index=True)
    description = Column(Text)
    difficulty = Column(String, default='beginner')
    status = Column(String, nullable=False, default='ready', index=True)
    color = Column(String, default='sea')
    created_at = Column(DateTime, default=now)

class CourseGenerationJob(TenantOwned, Base):
    __tablename__ = 'course_generation_jobs'
    id = Column(String, primary_key=True, default=uid)
    topic = Column(String, index=True)
    level = Column(String, default='beginner')
    status = Column(String, default='queued', index=True)
    progress_current = Column(Integer, default=0)
    progress_total = Column(Integer, default=0)
    log = Column(JSON, default=list)
    course_id = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)

class Lesson(TenantOwned, Base):
    __tablename__ = 'lessons'
    id = Column(String, primary_key=True, default=uid)
    course_id = Column(String, ForeignKey('courses.id', ondelete='CASCADE'))
    title = Column(String)
    content = Column(Text)
    position = Column(Integer)
    completed = Column(Boolean, default=False)
    source_chunk_ids = Column(JSON, default=list)

class Flashcard(TenantOwned, Base):
    __tablename__ = 'flashcards'
    id = Column(String, primary_key=True, default=uid)
    topic = Column(String, index=True)
    course_id = Column(String, nullable=True)
    subtopic = Column(String)
    question = Column(Text)
    answer = Column(Text)
    card_type = Column(String, default='definition')
    difficulty = Column(String, default='beginner')
    importance = Column(String, default='medium')
    explanation = Column(Text, default='')
    key_points = Column(JSON, default=list)
    worked_example = Column(Text, default='')
    reference_links = Column(JSON, default=list)
    source_chunk_ids = Column(JSON, default=list)
    next_review = Column(Date, default=date.today)
    mastery_score = Column(Integer, default=0)
    streak = Column(Integer, default=0)

class Quiz(TenantOwned, Base):
    __tablename__ = 'quizzes'
    id = Column(String, primary_key=True, default=uid)
    topic = Column(String)
    course_id = Column(String, nullable=True)
    title = Column(String)
    submitted = Column(Boolean, default=False)
    score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=now)

class QuizQuestion(TenantOwned, Base):
    __tablename__ = 'quiz_questions'
    id = Column(String, primary_key=True, default=uid)
    quiz_id = Column(String, ForeignKey('quizzes.id', ondelete='CASCADE'))
    question = Column(Text)
    options = Column(JSON)
    correct_index = Column(Integer)
    explanation = Column(Text)
    concept = Column(String)
    difficulty = Column(String, default='beginner')
    source_chunk_ids = Column(JSON, default=list)

class UserAnswer(TenantOwned, Base):
    __tablename__ = 'user_answers'
    id = Column(String, primary_key=True, default=uid)
    item_id = Column(String)
    answer = Column(Text)
    correct = Column(Boolean)
    created_at = Column(DateTime, default=now)

class Progress(TenantOwned, Base):
    __tablename__ = 'progress'
    __table_args__ = (UniqueConstraint('user_id', 'topic'),)
    id = Column(Integer, primary_key=True)
    topic = Column(String, index=True)
    cards_attempted = Column(Integer, default=0)
    cards_correct = Column(Integer, default=0)
    mastery_score = Column(Integer, default=0)
    weak_concepts = Column(JSON, default=list)
    next_revision = Column(Date, default=date.today)

class StudySession(TenantOwned, Base):
    __tablename__ = 'study_sessions'
    id = Column(String, primary_key=True, default=uid)
    topic = Column(String)
    kind = Column(String)
    xp = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)

class Reminder(TenantOwned, Base):
    __tablename__ = 'reminders'
    id = Column(String, primary_key=True, default=uid)
    topic = Column(String)
    message = Column(String)
    due = Column(Date)

class Note(TenantOwned, Base):
    __tablename__ = 'notes'
    id = Column(String, primary_key=True, default=uid)
    title = Column(String)
    content = Column(Text)
    topic = Column(String, default='General', index=True)
    updated_at = Column(DateTime, default=now, onupdate=now)

class UserAISetting(TenantOwned, Base):
    __tablename__ = 'user_ai_settings'
    id = Column(String, primary_key=True, default=uid)
    provider = Column(String, default='auto')
    credentials = Column(JSON, default=dict)
    cloud_models = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=now, onupdate=now)

class ChatThread(TenantOwned, Base):
    __tablename__ = 'chat_threads'
    id = Column(String, primary_key=True, default=uid)
    title = Column(String, default='New voyage')
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)

class ChatMessage(TenantOwned, Base):
    __tablename__ = 'chat_messages'
    id = Column(String, primary_key=True, default=uid)
    role = Column(String)
    content = Column(Text)
    topic = Column(String)
    citations = Column(JSON, default=list)
    thread_id = Column(String, ForeignKey('chat_threads.id', ondelete='CASCADE'), nullable=True, index=True)
    created_at = Column(DateTime, default=now)

def as_dict(obj):
    return {column.name: getattr(obj, column.name) for column in obj.__table__.columns}
