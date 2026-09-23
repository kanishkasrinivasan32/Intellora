from pathlib import Path
from typing import Literal
import os
from urllib.parse import urlparse
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    llm_provider: str = 'auto'
    ollama_base_url: str = 'http://localhost:11434'
    gemini_api_key: str = ''
    gemini_model: str = 'gemini-flash-latest'
    sarvam_api_key: str = ''
    sarvam_model: str = 'sarvam-105b'
    openrouter_api_key: str = ''
    openrouter_model: str = 'openai/gpt-4.1-mini'
    groq_api_key: str = ''
    groq_model: str = 'llama-3.3-70b-versatile'
    tutor_model: str = 'llama3.1:8b'
    flashcard_model: str = 'qwen2.5:7b'
    quiz_model: str = 'qwen2.5:7b'
    course_model: str = 'qwen2.5:7b'
    research_model: str = 'qwen2.5:7b'
    visualizer_model: str = 'qwen2.5:7b'
    embed_model: str = 'nomic-embed-text'
    app_env: Literal['development', 'production'] = 'development'
    multiuser_mode: bool = False
    allow_signup: bool = True
    ai_requests_per_user_day: int = 30
    ai_requests_global_day: int = 200
    max_resources_per_user: int = 25
    app_password: str = ''
    session_secret: str = ''
    allowed_hosts: str = 'localhost,127.0.0.1,testserver'
    allowed_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
    public_base_url: str = 'http://localhost:8000'
    google_client_id: str = ''
    google_client_secret: str = ''
    frontend_dist: Path = ROOT.parent / 'frontend' / 'dist'
    data_dir: Path = ROOT / 'data'

settings = Settings()
if os.getenv('RENDER_EXTERNAL_URL'):
    settings.public_base_url = os.environ['RENDER_EXTERNAL_URL'].rstrip('/')
    settings.allowed_hosts = urlparse(settings.public_base_url).hostname or settings.allowed_hosts
    settings.allowed_origins = settings.public_base_url
if settings.app_env == 'production':
    if len(settings.session_secret) < 32 or (not settings.multiuser_mode and len(settings.app_password) < 16):
        raise RuntimeError('Production requires SESSION_SECRET of at least 32 characters and MULTIUSER_MODE=true (or a private APP_PASSWORD of at least 16 characters).')
    if '*' in settings.allowed_hosts or '*' in settings.allowed_origins:
        raise RuntimeError('Production requires explicit ALLOWED_HOSTS and ALLOWED_ORIGINS; wildcards are not allowed.')
for folder in ['raw', 'processed', 'chroma', 'sqlite']:
    (settings.data_dir / folder).mkdir(parents=True, exist_ok=True)
