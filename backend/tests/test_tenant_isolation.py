"""Account boundaries must apply to reads, identity lookups, writes, and APIs."""
import pytest
from fastapi import Request
from sqlalchemy import create_engine, delete, func, select, update
from sqlalchemy.orm import aliased, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.seed import seed
from app.database.session import Base, TenantSession, current_user_id, get_db, migrate_legacy_schema
from app.models.entities import ChatMessage, Course, Lesson, Note, Progress, Topic, User


@pytest.fixture
def tenant_sessions():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, class_=TenantSession, expire_on_commit=False)
    for owner in ('alice', 'bob'):
        with factory(user_id=owner) as db:
            db.add(User(id=owner, name=owner.title(), username=owner))
            seed(db, user_id=owner, name=owner.title())
            db.add_all([Note(title=f'{owner} private', content=f'{owner} secret'),
                        ChatMessage(role='user', content=f'{owner} conversation', topic='Python')])
            db.commit()
    yield factory
    engine.dispose()


def test_each_account_gets_starters_without_topic_conflicts(tenant_sessions):
    for owner in ('alice', 'bob'):
        with tenant_sessions(user_id=owner) as db:
            assert db.scalar(select(func.count()).select_from(Course)) == 3
            assert {row.user_id for row in db.scalars(select(Topic))} == {owner}
            seed(db, user_id=owner, name=owner.title())
            assert db.scalar(select(func.count()).select_from(Course)) == 3
            db.add(Progress(topic='Python', mastery_score=25 if owner == 'alice' else 75))
            db.commit()
    with tenant_sessions(user_id='bob') as db:
        assert db.scalar(select(Progress)).mastery_score == 75


def test_identity_alias_aggregate_bulk_update_and_delete_are_scoped(tenant_sessions):
    with tenant_sessions(user_id='bob') as db:
        bob_note_id = db.scalar(select(Note.id))
    with tenant_sessions(user_id='alice') as db:
        assert db.get(Note, bob_note_id) is None
        assert db.scalar(select(func.count()).select_from(Note)) == 1
        note_alias = aliased(Note)
        assert [row.title for row in db.scalars(select(note_alias))] == ['alice private']
        db.execute(update(Note).values(content='alice revised'))
        db.execute(delete(ChatMessage))
        db.commit()
    with tenant_sessions(user_id='bob') as db:
        assert db.get(Note, bob_note_id).content == 'bob secret'
        assert db.scalar(select(func.count()).select_from(ChatMessage)) == 1


def test_session_captures_owner_and_rejects_forged_writes(tenant_sessions):
    token = current_user_id.set('alice')
    try:
        with tenant_sessions() as db:
            note = db.scalar(select(Note))
            shifted = current_user_id.set('bob')
            try:
                assert db.get(Note, note.id).user_id == 'alice'
                created = Note(title='Still Alice', content='Pinned session')
                db.add(created)
                db.commit()
                assert created.user_id == 'alice'
            finally:
                current_user_id.reset(shifted)
            db.add(Note(user_id='bob', title='Forged', content='Denied'))
            with pytest.raises(ValueError, match='different account'):
                db.flush()
            db.rollback()
    finally:
        current_user_id.reset(token)
    with tenant_sessions(user_id='bob') as db:
        bob_course_id = db.scalar(select(Course.id))
    with tenant_sessions(user_id='alice') as db:
        db.add(Lesson(course_id=bob_course_id, title='Foreign child', content='Denied'))
        with pytest.raises(ValueError, match='parent record'):
            db.flush()


def test_two_account_api_resource_and_progress_boundaries(client, tenant_sessions, monkeypatch):
    from app.main import app
    from app.config import settings
    monkeypatch.setattr(settings, 'multiuser_mode', False)
    monkeypatch.setattr(settings, 'app_password', '')

    def account_db(request: Request):
        with tenant_sessions(user_id=request.headers.get('x-test-owner', 'alice')) as db:
            yield db

    app.dependency_overrides[get_db] = account_db
    alice, bob = {'x-test-owner': 'alice'}, {'x-test-owner': 'bob'}
    try:
        alice_note = client.get('/api/notes', headers=alice).json()[0]
        bob_note = client.get('/api/notes', headers=bob).json()[0]
        assert alice_note['title'] == 'alice private'
        assert bob_note['title'] == 'bob private'
        assert client.put(f'/api/notes/{bob_note["id"]}', headers=alice, json={'title': 'Changed', 'content': 'Leaked'}).status_code == 404
        assert client.delete(f'/api/notes/{bob_note["id"]}', headers=alice).status_code == 404
        bob_course = client.get('/api/courses', headers=bob).json()[0]
        assert client.get(f'/api/courses/{bob_course["id"]}', headers=alice).status_code == 404
        bob_lesson_id = bob_course['lessons'][0]['id']
        assert client.post(f'/api/lessons/{bob_lesson_id}/complete', headers=alice).status_code == 404
        alice_lesson_id = client.get('/api/courses', headers=alice).json()[0]['lessons'][0]['id']
        assert client.post(f'/api/lessons/{alice_lesson_id}/complete', headers=alice).status_code == 200
        assert client.get('/api/progress', headers=alice).json()['xp'] == 50
        assert client.get('/api/progress', headers=bob).json()['xp'] == 0
        assert client.get('/api/progress', headers=bob).json()['lessons_completed'] == 0
        assert client.delete('/api/tutor/history', headers=alice).status_code == 200
        assert client.get('/api/tutor/history', headers=alice).json() == []
        assert client.get('/api/tutor/history', headers=bob).json()[0]['content'] == 'bob conversation'
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_legacy_database_migration_preserves_data_and_removes_global_topic_uniqueness():
    engine = create_engine('sqlite://', poolclass=StaticPool)
    with engine.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE users (id VARCHAR PRIMARY KEY, name VARCHAR)')
        connection.exec_driver_sql("INSERT INTO users VALUES ('kanishka', 'Kanishka')")
        connection.exec_driver_sql('CREATE TABLE topics (id VARCHAR PRIMARY KEY, name VARCHAR UNIQUE, hierarchy JSON)')
        connection.exec_driver_sql("INSERT INTO topics VALUES ('old-topic', 'Python', '[]')")
        connection.exec_driver_sql('CREATE TABLE progress (id INTEGER PRIMARY KEY, topic VARCHAR, cards_attempted INTEGER, cards_correct INTEGER, mastery_score INTEGER, weak_concepts JSON, next_revision DATE)')
        connection.exec_driver_sql('CREATE UNIQUE INDEX ix_progress_topic ON progress (topic)')
        connection.exec_driver_sql("INSERT INTO progress VALUES (1, 'Python', 4, 3, 75, '[]', '2026-09-21')")
        connection.exec_driver_sql('CREATE TABLE notes (id VARCHAR PRIMARY KEY, title VARCHAR, content TEXT, updated_at DATETIME)')
        connection.exec_driver_sql("INSERT INTO notes VALUES ('old-note', 'My existing note', 'Keep me', '2026-09-21 10:00:00')")
    Base.metadata.create_all(engine)
    migrate_legacy_schema(engine)
    migrate_legacy_schema(engine)  # Every startup must be safe.
    factory = sessionmaker(engine, class_=TenantSession)
    with factory(user_id='kanishka') as db:
        assert db.get(Note, 'old-note').content == 'Keep me'
        assert db.scalar(select(Progress)).mastery_score == 75
        assert db.get(User, 'kanishka').created_at is not None
    with factory(user_id='new-account') as db:
        assert db.get(Note, 'old-note') is None
        db.add_all([Topic(name='Python'), Progress(topic='Python', mastery_score=0)])
        db.commit()
        assert db.scalar(select(func.count()).select_from(Topic)) == 1
    engine.dispose()
