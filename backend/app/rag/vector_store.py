import json
import re
import threading
from functools import wraps
import httpx
from app.config import settings
from app.database.session import current_user_id
from app.services.llm_service import ensure_model, runtime, status

_client = None
_collection = None
_lock = threading.RLock()
EMBED_FILE = settings.data_dir / 'embedding.json'
LEGACY_OWNER = 'kanishka'
OWNERSHIP_VERSION = 'user-ownership-v1'

def synchronized(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        with _lock: return fn(*args, **kwargs)
    return wrapped


def owner_id():
    owner = current_user_id.get()
    if not isinstance(owner, str) or not owner:
        raise ValueError('An authenticated account is required to access knowledge.')
    return owner


def tenant_filter(*filters):
    """Include this account in every direct collection query or deletion."""
    predicates = [{'user_id': owner_id()}, *filters]
    return predicates[0] if len(predicates) == 1 else {'$and': predicates}


@synchronized
def migrate_legacy_ownership(col):
    """Only the original local account may inherit vectors without an owner.

    Run once per collection; metadata updates preserve existing embeddings.
    An interrupted migration is safe to resume because owned rows stay intact.
    """
    if (col.metadata or {}).get('ownership_version') == OWNERSHIP_VERSION:
        return
    for offset in range(0, col.count(), 500):
        batch = col.get(limit=500, offset=offset, include=['metadatas'])
        ids, metadatas = [], []
        for chunk_id, metadata in zip(batch['ids'], batch['metadatas']):
            if not (metadata or {}).get('user_id'):
                ids.append(chunk_id)
                metadatas.append({**(metadata or {}), 'user_id': LEGACY_OWNER})
        if ids:
            col.update(ids=ids, metadatas=metadatas)
    # Chroma rejects hnsw:space in modify(), including its unchanged value.
    # The existing index keeps its distance configuration independently.
    metadata = {key: value for key, value in (col.metadata or {}).items() if not key.startswith('hnsw:')}
    col.modify(metadata={**metadata, 'ownership_version': OWNERSHIP_VERSION})


def collection():
    global _client, _collection
    with _lock:
        if _collection is None:
            import chromadb
            _client = chromadb.PersistentClient(path=str(settings.data_dir / 'chroma'))
            manifest = json.loads(EMBED_FILE.read_text()) if EMBED_FILE.exists() else {}
            col = _client.get_or_create_collection(manifest.get('collection', 'knowledge'), metadata={'hnsw:space': 'cosine'})
            migrate_legacy_ownership(col)
            _collection = col
        return _collection

def embed(texts, choice_override=None):
    """Persist the embedding backend so query and document vectors never silently mix."""
    with _lock:
        choice = choice_override or (json.loads(EMBED_FILE.read_text()) if EMBED_FILE.exists() else None)
        if choice is None:
            try:
                ensure_model(runtime['models']['embedding'])
                choice = {'provider': 'ollama', 'model': runtime['models']['embedding']}
            except Exception:
                choice = {'provider': 'onnx', 'model': 'all-MiniLM-L6-v2'}
                status.update(state='embedding', message='Preparing local MiniLM embeddings (first run downloads the model)')
        if choice['provider'] == 'ollama':
            ensure_model(choice['model'])
            response = httpx.post(f'{settings.ollama_base_url}/api/embed', json={'model': choice['model'], 'input': texts}, timeout=240)
            response.raise_for_status()
            result = response.json()['embeddings']
        else:
            from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2
            result = [x.tolist() for x in ONNXMiniLM_L6_V2()(texts)]
        if not EMBED_FILE.exists() and not choice_override: EMBED_FILE.write_text(json.dumps(choice))
        return result

@synchronized
def index_chunks(chunks, title):
    owner = owner_id()
    if any(getattr(chunk, 'user_id', None) != owner for chunk in chunks):
        raise ValueError('Cannot index another account\'s knowledge.')
    col = collection()
    # Chroma IDs are global within a collection. Validate existing ownership
    # before upsert so even a forged or reused ID cannot overwrite another user.
    for offset in range(0, len(chunks), 500):
        existing = col.get(ids=[chunk.id for chunk in chunks[offset:offset+500]], include=['metadatas'])
        if any((metadata or {}).get('user_id') != owner for metadata in existing['metadatas']):
            raise ValueError('Cannot overwrite another account\'s knowledge.')
    for offset in range(0, len(chunks), 32):
        batch = chunks[offset:offset+32]
        status.update(state='embedding', message=f'Indexing {title}: {offset + len(batch)}/{len(chunks)} passages')
        col.upsert(ids=[x.id for x in batch], documents=[x.content for x in batch], embeddings=embed([x.content for x in batch]),
                   metadatas=[{'user_id': owner, 'source_id': x.source_id, 'topic': x.topic, 'title': title, 'difficulty': x.difficulty} for x in batch])

@synchronized
def remove_source(source_id):
    collection().delete(where=tenant_filter({'source_id': source_id}))

@synchronized
def search(query, topic=None, difficulty=None, limit=6):
    owner = owner_id()
    if limit <= 0: return []
    col = collection()
    if not col.count(): return []
    filters = []
    if topic and topic != 'All topics': filters.append({'topic': topic})
    if difficulty: filters.append({'difficulty': difficulty})
    where = tenant_filter(*filters)
    result = col.query(query_embeddings=embed([query]), n_results=min(limit*2, col.count()), where=where)
    terms = set(re.findall(r'\w+', query.lower()))
    rows = []
    for i, id in enumerate(result['ids'][0]):
        metadata = result['metadatas'][0][i] or {}
        # Keep citation content protected even if a storage backend ever
        # returns a row outside its requested metadata filter.
        if metadata.get('user_id') != owner:
            continue
        content = result['documents'][0][i]
        distance = result['distances'][0][i]
        lexical = len(terms & set(re.findall(r'\w+', content.lower()))) / max(len(terms), 1)
        rows.append({'id': id, 'content': content, **metadata, 'score': round(1-distance + lexical * .15, 4)})
    return sorted(rows, key=lambda x: x['score'], reverse=True)[:limit]

@synchronized
def migrate_embedding(model):
    """Build a separate index and atomically switch only after every vector succeeds."""
    global _collection
    from uuid import uuid4
    from sqlalchemy import select
    from app.database.session import Session
    from app.models.entities import Chunk, Source
    from app.services.llm_service import save_settings
    candidate = None
    try:
        ensure_model(model)
        collection()
        name = 'knowledge-' + uuid4().hex
        candidate = _client.create_collection(name, metadata={'hnsw:space': 'cosine', 'ownership_version': OWNERSHIP_VERSION})
        choice = {'provider': 'ollama', 'model': model, 'collection': name}
        # A model change replaces the shared collection, so rebuild every
        # account, including retained chunks from a failed source refresh.
        with Session(unscoped=True) as db:
            rows = list(db.execute(select(Chunk, Source.title).join(
                Source, (Source.id == Chunk.source_id) & (Source.user_id == Chunk.user_id))))
            for offset in range(0, len(rows), 32):
                batch = rows[offset:offset+32]
                status.update(state='embedding', message=f'Rebuilding knowledge with {model}: {min(offset+32,len(rows))}/{len(rows)} passages')
                candidate.upsert(ids=[r[0].id for r in batch], documents=[r[0].content for r in batch],
                    embeddings=embed([r[0].content for r in batch], choice),
                    metadatas=[{'user_id':r[0].user_id,'source_id':r[0].source_id,'topic':r[0].topic,'title':r[1],'difficulty':r[0].difficulty} for r in batch])
        # Check the model even for an empty library before switching.
        if not rows: embed(['Verify embedding model'], choice)
        temp = EMBED_FILE.with_suffix('.tmp')
        temp.write_text(json.dumps(choice)); temp.replace(EMBED_FILE)
        _collection = candidate
        save_settings(runtime['provider'], {'embedding': model})
        status.update(state='ready', message=f'Knowledge index now uses {model}')
    except Exception:
        if candidate is not None and candidate is not _collection:
            _client.delete_collection(candidate.name)
        status.update(state='error', message='Embedding migration failed. Start Ollama and retry. Your previous knowledge index is still intact.')
