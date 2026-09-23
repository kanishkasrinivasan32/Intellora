"""Small authenticated-at-rest store for user-supplied provider credentials."""
import base64
import hashlib
import os
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings

KEY_FILE = settings.data_dir / '.credential-key'

def _key() -> bytes:
    if settings.session_secret:
        material = settings.session_secret.encode()
    else:
        if not KEY_FILE.exists():
            KEY_FILE.write_bytes(os.urandom(32))
        material = KEY_FILE.read_bytes()
    return base64.urlsafe_b64encode(hashlib.sha256(material).digest())

def seal(value: str) -> str:
    return Fernet(_key()).encrypt(value.encode()).decode() if value else ''

def open_secret(value: str) -> str:
    if not value:
        return ''
    try:
        return Fernet(_key()).decrypt(value.encode()).decode()
    except InvalidToken:
        return ''
