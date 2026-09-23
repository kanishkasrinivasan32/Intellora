import io
from unittest.mock import Mock

import pytest
from sqlalchemy import select

from app.database.session import Session, current_user_id
from app.ingestion import pipeline
from app.models.entities import Source, Document, Chunk
from app.rag import vector_store


@pytest.fixture
def indexed_source(client):
    response = client.post('/api/resources/upload', data={'topic': 'Recovery tests'},
                           files={'file': ('original.txt', b'The original lighthouse signal is AMBER.', 'text/plain')})
    assert response.status_code == 201
    source_id = response.json()['id']
    assert client.get(f'/api/resources/{source_id}').json()['status'] == 'ready'
    yield source_id
    assert client.delete(f'/api/resources/{source_id}').status_code == 200


def saved_content(source_id):
    with Session() as db:
        source = db.get(Source, source_id)
        documents = [(x.id, x.content) for x in db.scalars(select(Document).where(Document.source_id == source_id))]
        chunks = [(x.id, x.content) for x in db.scalars(select(Chunk).where(Chunk.source_id == source_id).order_by(Chunk.position))]
        result = {'title': source.title, 'chunk_count': source.chunks, 'documents': documents, 'chunks': chunks}
    rows = vector_store.collection().get(where={'source_id': source_id}, include=['documents', 'metadatas', 'embeddings'])
    result['vectors'] = {
        chunk_id: (rows['documents'][i], rows['metadatas'][i], list(rows['embeddings'][i]))
        for i, chunk_id in enumerate(rows['ids'])
    }
    return result


def replacement_input(monkeypatch):
    monkeypatch.setattr(pipeline, 'read_file', lambda _: ('A replacement explains the new signal.', {'title': 'Replacement'}))
    monkeypatch.setattr(pipeline, 'chunk_text', lambda _: ['The new signal is BLUE.', 'A second replacement passage.'])


def assert_old_content_survives(source_id, previous):
    assert saved_content(source_id) == previous
    with Session() as db:
        source = db.get(Source, source_id)
        assert source.status == 'error'
        assert source.error


def test_reindex_cleans_partial_vectors_and_preserves_old_content(indexed_source, monkeypatch):
    previous = saved_content(indexed_source)
    replacement_input(monkeypatch)
    index_chunks = vector_store.index_chunks

    def partially_index_then_fail(chunks, title):
        index_chunks(chunks[:1], title)
        raise RuntimeError('The second embedding batch failed')

    monkeypatch.setattr(vector_store, 'index_chunks', partially_index_then_fail)
    pipeline.process_source(indexed_source)
    assert_old_content_survives(indexed_source, previous)


def test_reindex_restores_vectors_after_sql_commit_failure(indexed_source, monkeypatch):
    previous = saved_content(indexed_source)
    replacement_input(monkeypatch)
    commit = Session.class_.commit
    failed = False

    def fail_replacement_commit(db):
        nonlocal failed
        source = db.get(Source, indexed_source)
        if not failed and source and source.status == 'ready':
            failed = True
            raise RuntimeError('SQL commit failed')
        return commit(db)

    monkeypatch.setattr(Session.class_, 'commit', fail_replacement_commit)
    pipeline.process_source(indexed_source)
    assert failed
    assert_old_content_survives(indexed_source, previous)


def test_reindex_restores_old_vectors_after_partial_delete(indexed_source, monkeypatch):
    previous = saved_content(indexed_source)
    replacement_input(monkeypatch)
    actual = vector_store.collection()
    collection = Mock(wraps=actual)
    old_ids = set(previous['vectors'])
    failed = False

    def partially_delete_then_fail(**kwargs):
        nonlocal failed
        if not failed and set(kwargs.get('ids', [])) == old_ids:
            failed = True
            actual.delete(ids=kwargs['ids'][:1])
            raise RuntimeError('Vector deletion failed')
        return actual.delete(**kwargs)

    collection.delete.side_effect = partially_delete_then_fail
    monkeypatch.setattr(vector_store, 'collection', lambda: collection)
    pipeline.process_source(indexed_source)
    assert failed
    assert_old_content_survives(indexed_source, previous)


def test_successful_reindex_replaces_both_stores(indexed_source, monkeypatch):
    previous = saved_content(indexed_source)
    replacement_input(monkeypatch)
    pipeline.process_source(indexed_source)
    current = saved_content(indexed_source)
    assert current['title'] == 'Replacement'
    assert current['chunk_count'] == 2
    assert {chunk_id for chunk_id, _ in current['chunks']} == set(current['vectors'])
    assert not set(previous['vectors']) & set(current['vectors'])
    assert current['documents'][0][1] == 'A replacement explains the new signal.'


def test_background_job_uses_explicit_owner_and_restores_context(indexed_source, monkeypatch):
    replacement_input(monkeypatch)
    owner = current_user_id.get()
    token = current_user_id.set('another-account')
    try:
        pipeline.process_source(indexed_source, user_id=owner)
        assert current_user_id.get() == 'another-account'
    finally:
        current_user_id.reset(token)
    current = saved_content(indexed_source)
    assert current['title'] == 'Replacement'
    assert all(metadata['user_id'] == owner for _, metadata, _ in current['vectors'].values())


def test_background_job_cannot_process_another_accounts_source(indexed_source, monkeypatch):
    previous = saved_content(indexed_source)
    owner = current_user_id.get()
    reader = Mock(side_effect=AssertionError('A foreign source must not be opened'))
    monkeypatch.setattr(pipeline, 'read_file', reader)
    pipeline.process_source(indexed_source, user_id='another-account')
    reader.assert_not_called()
    assert current_user_id.get() == owner
    assert saved_content(indexed_source) == previous


def test_image_only_pdf_is_rejected_without_indexing(client):
    import fitz
    from PIL import Image

    image = io.BytesIO()
    Image.new('RGB', (20, 20), 'white').save(image, format='PNG')
    with fitz.open() as pdf:
        page = pdf.new_page()
        page.insert_image(page.rect, stream=image.getvalue())
        response = client.post('/api/resources/upload', files={'file': ('scan.pdf', pdf.tobytes(), 'application/pdf')})
    source_id = response.json()['id']
    source = client.get(f'/api/resources/{source_id}').json()
    assert source['status'] == 'error'
    assert 'OCR' in source['error']
    assert source['chunks'] == 0
    assert not saved_content(source_id)['vectors']
    assert client.delete(f'/api/resources/{source_id}').status_code == 200


def test_pdf_preserves_original_page_numbers_and_omits_empty_pages(tmp_path):
    import fitz
    from app.ingestion.readers import read_file

    path = tmp_path / 'mixed.pdf'
    with fitz.open() as pdf:
        pdf.new_page()
        page = pdf.new_page()
        page.insert_text((72, 72), 'Only this page has extracted text.')
        pdf.save(path)
    text, metadata = read_file(path)
    assert '## Page 2' in text and 'Only this page' in text
    assert '## Page 1' not in text
    assert metadata['pages'] == 2
