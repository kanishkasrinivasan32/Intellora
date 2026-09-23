from contextlib import contextmanager
from types import SimpleNamespace

import chromadb
import pytest

from app.database.session import current_user_id
from app.rag import vector_store as vectors


@contextmanager
def account(user_id):
    token = current_user_id.set(user_id)
    try:
        yield
    finally:
        current_user_id.reset(token)


@pytest.fixture
def isolated_vectors(tmp_path, monkeypatch):
    client = chromadb.PersistentClient(path=str(tmp_path / 'chroma'))
    col = client.create_collection('tenant-tests', metadata={'hnsw:space': 'cosine'})
    monkeypatch.setattr(vectors, '_client', client)
    monkeypatch.setattr(vectors, '_collection', col)
    monkeypatch.setattr(vectors, 'EMBED_FILE', tmp_path / 'embedding.json')
    return col


def chunk(user_id, chunk_id, source_id='shared-source-id', content='The harbor code is SECRET.'):
    return SimpleNamespace(user_id=user_id, id=chunk_id, source_id=source_id,
                           content=content, topic='Navigation', difficulty='beginner')


def test_search_and_citations_are_limited_to_current_account(isolated_vectors):
    for owner, code in [('alice', 'ALICE-742'), ('bob', 'BOB-982')]:
        with account(owner):
            vectors.index_chunks([chunk(owner, owner + '-chunk', content=f'The harbor code is {code}.')], owner + ' private notes')

    for owner, code in [('alice', 'ALICE-742'), ('bob', 'BOB-982')]:
        with account(owner):
            for filters in [{}, {'topic': 'Navigation'}, {'difficulty': 'beginner'},
                            {'topic': 'Navigation', 'difficulty': 'beginner'}]:
                matches = vectors.search('harbor code', **filters)
                assert len(matches) == 1
                assert matches[0]['id'] == owner + '-chunk'
                assert matches[0]['user_id'] == owner
                assert matches[0]['title'] == owner + ' private notes'
                assert code in matches[0]['content']
    with account('empty-account'):
        assert vectors.search('harbor code') == []


def test_source_delete_requires_owner_even_when_source_ids_match(isolated_vectors):
    for owner in ['alice', 'bob']:
        with account(owner):
            vectors.index_chunks([chunk(owner, owner + '-chunk')], owner)
    with account('alice'):
        vectors.remove_source('shared-source-id')
        assert vectors.search('harbor') == []
    with account('bob'):
        assert [row['id'] for row in vectors.search('harbor')] == ['bob-chunk']


def test_upsert_cannot_forge_an_owner_or_overwrite_another_account(isolated_vectors):
    with account('alice'):
        vectors.index_chunks([chunk('alice', 'original')], 'Alice')
    with account('bob'):
        with pytest.raises(ValueError, match='another account'):
            vectors.index_chunks([chunk('alice', 'forged')], 'Forged')
        with pytest.raises(ValueError, match='another account'):
            vectors.index_chunks([chunk('bob', 'original', content='Overwritten')], 'Bob')
    with account('alice'):
        assert 'SECRET' in vectors.search('harbor')[0]['content']


def test_legacy_vectors_belong_only_to_original_local_account(isolated_vectors):
    isolated_vectors.upsert(ids=['legacy', 'existing-account'],
        documents=['Legacy private harbor code', 'Bob private harbor code'],
        embeddings=vectors.embed(['Legacy private harbor code', 'Bob private harbor code']),
        metadatas=[{'source_id': 'legacy-source', 'title': 'Old library', 'topic': 'Navigation'},
                   {'source_id': 'bob-source', 'title': 'Bob library', 'topic': 'Navigation', 'user_id': 'bob'}])
    with account('new-user'):
        vectors.migrate_legacy_ownership(isolated_vectors)
        vectors.migrate_legacy_ownership(isolated_vectors)
        assert vectors.search('harbor') == []
    with account('kanishka'):
        assert [row['id'] for row in vectors.search('harbor')] == ['legacy']
    with account('bob'):
        assert [row['id'] for row in vectors.search('harbor')] == ['existing-account']


def test_search_discards_foreign_rows_even_if_storage_filter_is_broken(isolated_vectors, monkeypatch):
    with account('bob'):
        vectors.index_chunks([chunk('bob', 'private-bob')], 'Private title')
    original_query = isolated_vectors.query
    def unfiltered_query(**kwargs):
        kwargs.pop('where', None)
        return original_query(**kwargs)
    monkeypatch.setattr(isolated_vectors, 'query', unfiltered_query)
    with account('alice'):
        assert vectors.search('harbor') == []


def test_embedding_migration_preserves_every_account_and_retained_source(isolated_vectors, tmp_path, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import session
    from app.models.entities import Source, Chunk
    from app.services import llm_service

    engine = create_engine(f'sqlite:///{tmp_path / "migration.db"}')
    session.Base.metadata.create_all(engine)
    test_session = sessionmaker(engine, class_=session.TenantSession, expire_on_commit=False)
    monkeypatch.setattr(session, 'Session', test_session)
    monkeypatch.setattr(vectors, 'ensure_model', lambda model: None)
    monkeypatch.setattr(llm_service, 'save_settings', lambda *args: None)
    original_embed = vectors.embed
    monkeypatch.setattr(vectors, 'embed', lambda texts, choice_override=None: original_embed(texts))
    try:
        for owner, state in [('alice', 'ready'), ('bob', 'error')]:
            with test_session(user_id=owner) as db:
                db.add(Source(id=owner + '-source', title=owner + ' notes', file_type='txt',
                              status=state, topic='Navigation'))
                db.flush()
                db.add(Chunk(id=owner + '-chunk', source_id=owner + '-source',
                             content=owner + ' private harbor code', topic='Navigation',
                             position=0, difficulty='beginner'))
                db.commit()
        # The rebuild runs from one request context but must retain both users.
        with account('alice'):
            vectors.migrate_embedding('test-new-model')
            assert vectors.status['state'] == 'ready'
            assert vectors.collection().name != isolated_vectors.name
            assert [row['id'] for row in vectors.search('harbor')] == ['alice-chunk']
        with account('bob'):
            assert [row['id'] for row in vectors.search('harbor')] == ['bob-chunk']
        assert vectors.collection().count() == 2
    finally:
        engine.dispose()
