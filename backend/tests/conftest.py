import os
import tempfile
from pathlib import Path
import hashlib
import pytest

os.environ['DATA_DIR'] = tempfile.mkdtemp(prefix='intellora-tests-')

@pytest.fixture(scope='session')
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as client: yield client

@pytest.fixture(autouse=True)
def local_test_embeddings(monkeypatch):
    from app.rag import vector_store
    def embed(texts):
        vectors = []
        for text in texts:
            vector = [0.0] * 64
            for word in text.lower().split(): vector[int(hashlib.md5(word.encode()).hexdigest(), 16) % 64] += 1.0
            vectors.append(vector)
        return vectors
    monkeypatch.setattr(vector_store, 'embed', embed)
