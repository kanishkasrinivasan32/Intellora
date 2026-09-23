from sqlalchemy import select, delete
from app.database.session import Session, current_user_id
from app.models.entities import Source, Document, Chunk, Topic, uid
from app.ingestion.readers import read_file
from app.ingestion.web import read_website, read_youtube
from app.rag.chunker import chunk_text
from app.rag import vector_store
from app.services.llm_service import status

@vector_store.synchronized
def replace_source(db, source, text, meta):
    """Keep readers out while replacing the SQL and vector copies together.

    New vectors use fresh IDs, so a failed embedding batch cannot overwrite the
    current index. Retain the old vectors until staging and SQL flush succeed,
    and restore them if deletion or the final SQL commit fails.
    """
    if source.user_id != current_user_id.get():
        raise ValueError('This source does not belong to the active workspace.')
    title = meta.get('title') or source.title
    chunks = [Chunk(id=uid(), user_id=source.user_id, source_id=source.id, topic=source.topic, content=part,
                    position=i, difficulty='beginner')
              for i, part in enumerate(chunk_text(text))]
    if not chunks:
        raise ValueError('No readable passages found in this source.')
    col = vector_store.collection()
    previous = col.get(where=vector_store.tenant_filter({'source_id': source.id}),
                       include=['documents', 'metadatas', 'embeddings'])
    staged_ids = [chunk.id for chunk in chunks]
    previous_touched = False
    try:
        vector_store.index_chunks(chunks, title)
        db.execute(delete(Chunk).where(Chunk.source_id == source.id))
        db.execute(delete(Document).where(Document.source_id == source.id))
        db.add(Document(user_id=source.user_id, source_id=source.id, title=title, content=text,
                        file_type=source.file_type, topic=source.topic, details=meta))
        db.add_all(chunks)
        if not db.scalar(select(Topic).where(Topic.name == source.topic)):
            db.add(Topic(name=source.topic))
        source.title = title
        source.status = 'ready'
        source.chunks = len(chunks)
        db.flush()
        if previous['ids']:
            previous_touched = True
            col.delete(ids=previous['ids'], where=vector_store.tenant_filter())
        db.commit()
    except Exception:
        db.rollback()
        try:
            if previous_touched:
                col.upsert(ids=previous['ids'], documents=previous['documents'],
                           metadatas=previous['metadatas'], embeddings=previous['embeddings'])
        finally:
            # This also removes batches written before index_chunks raised.
            col.delete(ids=staged_ids, where=vector_store.tenant_filter())
        raise

def process_source(source_id, user_id=None):
    """Bind the submitting account explicitly for the whole background job."""
    owner = current_user_id.get() if user_id is None else user_id
    token = current_user_id.set(owner)
    try:
        _process_source(source_id, owner)
    finally:
        current_user_id.reset(token)


def _process_source(source_id, owner):
    with Session(user_id=owner) as db:
        source = db.scalar(select(Source).where(Source.id == source_id, Source.user_id == owner))
        if not source: return
        try:
            source.status = 'processing'; source.error = None; db.commit()
            if source.file_type == 'youtube': text, meta = read_youtube(source.url)
            elif source.file_type == 'website': text, meta = read_website(source.url)
            else: text, meta = read_file(source.path)
            if not text.strip(): raise ValueError('No readable text found. Scanned PDFs need OCR before upload.')
            if len(text) > 2_000_000: raise ValueError('Document is too large. Split it into smaller files (2 million characters maximum).')
            replace_source(db, source, text, meta)
            status.update(state='ready', message=f'{source.title} is ready to explore')
        except Exception as exc:
            db.rollback()
            source = db.get(Source, source_id)
            if source:
                source.status = 'error'
                source.error = str(exc)[:500] if isinstance(exc, ValueError) else 'Processing failed. Check the file, network connection, and local embedding model, then retry.'
                db.commit()
                status.update(state='error', message=source.error)
