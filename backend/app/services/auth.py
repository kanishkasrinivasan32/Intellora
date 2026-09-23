"""Local access, private password access, and public accounts with isolated workspaces."""
import hashlib
import hmac
import re
import secrets
import time
import threading
from urllib.parse import urlencode
from collections import defaultdict, deque
from datetime import datetime, timedelta
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
import httpx
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, select, func, delete
from sqlalchemy.exc import IntegrityError
from app.config import settings
from app.database.session import Base, Session, current_user_id
from app.models.entities import User, Source, uid

COOKIE = 'intellora_session'
TTL = 8 * 60 * 60
ITERATIONS = 600_000
_attempts = defaultdict(deque)
_lock = threading.RLock()
_dev_secret = secrets.token_hex(32)

class AuthSession(Base):
    __tablename__ = 'auth_sessions'
    id = Column(String, primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)

class AIUsage(Base):
    __tablename__ = 'ai_usage'
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.now, index=True)

class LoginRequest(BaseModel):
    username: str = Field(default='', max_length=40)
    password: str = Field(min_length=1, max_length=1024)

class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    name: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=12, max_length=128)

def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), ITERATIONS).hex()
    return f'pbkdf2_sha256${ITERATIONS}${salt}${digest}'

def check_password(password, stored):
    try:
        algorithm, rounds, salt, expected = stored.split('$')
        if algorithm != 'pbkdf2_sha256': return False
        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), int(rounds)).hex()
        return hmac.compare_digest(digest, expected)
    except (AttributeError, ValueError, TypeError): return False

_dummy_hash = hash_password(secrets.token_hex(16))

def token_digest(token):
    secret = settings.session_secret or _dev_secret
    if not settings.multiuser_mode: secret += settings.app_password
    return hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()

def public_user(user):
    return {'id':user.id,'name':user.name,'username':user.username,'is_admin':bool(user.is_admin)} if user else None

def identify(request):
    with Session(unscoped=True) as db:
        if not settings.multiuser_mode and not settings.app_password:
            return db.get(User, 'kanishka')
        token = request.cookies.get(COOKIE)
        if not token or len(token)>128: return None
        session = db.get(AuthSession, token_digest(token))
        if not session or session.expires_at <= datetime.now(): return None
        return db.get(User, session.user_id)

def throttle(bucket, key, count, seconds):
    now = time.monotonic()
    with _lock:
        if len(_attempts)>10000: _attempts.clear()
        attempts = _attempts[(bucket,key)]
        while attempts and now-attempts[0]>seconds: attempts.popleft()
        if len(attempts)>=count: raise HTTPException(429,'Too many attempts. Take a short break and try again later.')
        attempts.append(now)

def create_session(user):
    token = secrets.token_urlsafe(32)
    with Session(unscoped=True) as db:
        db.execute(delete(AuthSession).where(AuthSession.expires_at < datetime.now()))
        db.add(AuthSession(id=token_digest(token),user_id=user.id,expires_at=datetime.now()+timedelta(seconds=TTL)))
        db.commit()
    return token

def attach_session(response, token):
    response.set_cookie(COOKIE,token,max_age=TTL,httponly=True,secure=settings.app_env=='production',samesite='strict',path='/')
    return response

def issue_session(user):
    return attach_session(JSONResponse({'authenticated':True,'user':public_user(user)}), create_session(user))

def reserve_ai_request(user_id):
    """Persist reservations, including failed calls, before contacting a provider."""
    if not settings.multiuser_mode: return
    midnight = datetime.now().replace(hour=0,minute=0,second=0,microsecond=0)
    with _lock, Session(unscoped=True) as db:
        total = db.scalar(select(func.count()).select_from(AIUsage).where(AIUsage.created_at>=midnight))
        own = db.scalar(select(func.count()).select_from(AIUsage).where(AIUsage.created_at>=midnight,AIUsage.user_id==user_id))
        if own >= settings.ai_requests_per_user_day:
            raise HTTPException(429,'You have used today’s AI allowance. Your lessons and practice remain available; AI resets tomorrow.')
        if total >= settings.ai_requests_global_day:
            raise HTTPException(429,'The ship has reached today’s shared AI allowance. Please return tomorrow.')
        db.add(AIUsage(user_id=user_id)); db.commit()

def register_security(app):
    api_roots = {'resources','knowledge','courses','lessons','tutor','flashcards','quizzes','progress','recommendations','reminders','settings','notes','visualize','status','events','docs','redoc','openapi.json'}
    public_routes = {'/api/auth/status','/api/auth/login','/api/auth/signup','/api/auth/google','/api/auth/google/callback','/api/health','/health'}
    allowed_origins = set(x.strip() for x in settings.allowed_origins.split(',') if x.strip())

    @app.middleware('http')
    async def gate(request, call_next):
        path = request.url.path
        bare = path.removeprefix('/api')
        root = path.strip('/').split('/')[0]
        protected = path.startswith('/api/') or root in api_roots
        if request.method in ('POST','PUT','PATCH','DELETE'):
            origin = request.headers.get('origin')
            if origin and origin not in allowed_origins:
                return JSONResponse({'detail':'This request came from an untrusted origin.'},status_code=403)
            length = request.headers.get('content-length')
            if length:
                try: too_large = int(length)>27*1024*1024
                except ValueError: too_large=True
                if too_large: return JSONResponse({'detail':'Request exceeds the upload limit.'},status_code=413)
        user = identify(request) if protected else None
        request.state.user = user
        if protected and path not in public_routes and request.method != 'OPTIONS' and user is None:
            return JSONResponse({'detail':'Please sign in to your workspace.'},status_code=401)
        owner_token = current_user_id.set(user.id if user else '__anonymous__')
        try:
            if settings.multiuser_mode and user and request.method=='POST':
                try:
                    if bare in {'/tutor/ask','/tutor/explain-again','/tutor/simplify','/tutor/give-example','/courses/generate','/flashcards/generate','/quizzes/generate','/visualize'}:
                        reserve_ai_request(user.id)
                    if bare in {'/resources/upload','/resources/url','/resources/youtube','/resources/research'}:
                        with Session(user_id=user.id) as db:
                            count = db.scalar(select(func.count()).select_from(Source))
                        if count >= settings.max_resources_per_user-(2 if bare.endswith('/research') else 0):
                            raise HTTPException(429,'Your resource library is full. Remove an unused resource before adding another.')
                except HTTPException as exc: return JSONResponse({'detail':exc.detail},status_code=exc.status_code)
            response = await call_next(request)
        finally: current_user_id.reset(owner_token)
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
        response.headers['X-Frame-Options']='DENY'
        if protected: response.headers['Cache-Control']='no-store'
        if settings.app_env=='production':
            response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        return response

    @app.get('/api/auth/status')
    def auth_status(request:Request):
        return {'required':settings.multiuser_mode or bool(settings.app_password),'authenticated':request.state.user is not None,
                'hosted':settings.app_env=='production','multiuser':settings.multiuser_mode,'signup_open':settings.allow_signup,
                'google_configured': bool(settings.google_client_id and settings.google_client_secret),
                'user':public_user(request.state.user)}

    @app.get('/api/auth/google')
    def google_login():
        if not settings.multiuser_mode or not settings.google_client_id or not settings.google_client_secret:
            raise HTTPException(404, 'Google sign-in is not configured.')
        state = secrets.token_urlsafe(24)
        callback = f'{settings.public_base_url.rstrip("/")}/api/auth/google/callback'
        url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({
            'client_id': settings.google_client_id, 'redirect_uri': callback, 'response_type': 'code',
            'scope': 'openid email profile', 'state': state, 'prompt': 'select_account',
        })
        response = RedirectResponse(url)
        response.set_cookie('intellora_oauth_state', token_digest(state), max_age=600, httponly=True,
                            secure=settings.app_env=='production', samesite='lax', path='/api/auth/google/callback')
        return response

    @app.get('/api/auth/google/callback')
    def google_callback(request: Request, code: str = '', state: str = '', error: str = ''):
        expected = request.cookies.get('intellora_oauth_state', '')
        if error or not code or not state or not expected or not hmac.compare_digest(expected, token_digest(state)):
            return RedirectResponse('/?auth_error=google')
        callback = f'{settings.public_base_url.rstrip("/")}/api/auth/google/callback'
        try:
            token_response = httpx.post('https://oauth2.googleapis.com/token', data={
                'code': code, 'client_id': settings.google_client_id, 'client_secret': settings.google_client_secret,
                'redirect_uri': callback, 'grant_type': 'authorization_code',
            }, timeout=20)
            token_response.raise_for_status()
            access_token = token_response.json()['access_token']
            profile_response = httpx.get('https://openidconnect.googleapis.com/v1/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}, timeout=20)
            profile_response.raise_for_status(); profile = profile_response.json()
            if not profile.get('email') or not profile.get('sub'):
                raise ValueError('Google did not return an account identity.')
        except (httpx.HTTPError, KeyError, ValueError):
            return RedirectResponse('/?auth_error=google')
        with Session(unscoped=True) as db:
            user = db.get(User, f'google:{profile["sub"]}') or db.scalar(select(User).where(User.email == profile['email'].lower()))
            if not user:
                user = User(id=f'google:{profile["sub"]}', username=None, email=profile['email'].lower(),
                            name=(profile.get('name') or profile['email'].split('@')[0])[:60], is_admin=False)
                db.add(user); db.flush()
                from app.database.seed import seed
                seed(db, user_id=user.id, name=user.name, force=True)
                db.commit()
            token = create_session(user)
        response = attach_session(RedirectResponse('/'), token)
        response.delete_cookie('intellora_oauth_state', path='/api/auth/google/callback')
        return response

    @app.post('/api/auth/login')
    def auth_login(body:LoginRequest,request:Request):
        throttle('login',request.client.host if request.client else 'unknown',10,300)
        with Session(unscoped=True) as db:
            if settings.multiuser_mode:
                user = db.scalar(select(User).where(User.username==body.username.strip().lower()))
                matches = check_password(body.password,user.password_hash if user else _dummy_hash)
            else:
                user = db.get(User,'kanishka')
                matches = bool(settings.app_password) and hmac.compare_digest(hashlib.sha256(body.password.encode()).digest(),hashlib.sha256(settings.app_password.encode()).digest())
            if not user or not matches: raise HTTPException(401,'The username or password is incorrect.')
            return issue_session(user)

    @app.post('/api/auth/signup',status_code=201)
    def auth_signup(body:SignupRequest,request:Request):
        if not settings.multiuser_mode or not settings.allow_signup: raise HTTPException(403,'New accounts are currently closed.')
        throttle('signup',request.client.host if request.client else 'unknown',3,3600)
        throttle('signup-global','all',30,3600)
        username=body.username.strip().lower()
        if not re.fullmatch(r'[a-z0-9_]{3,32}',username): raise HTTPException(422,'Use 3–32 lowercase letters, numbers or underscores for your username.')
        name=body.name.strip()
        if not name: raise HTTPException(422,'Enter your display name.')
        user=User(id=uid(),username=username,name=name,password_hash=hash_password(body.password),is_admin=False)
        with Session(user_id=user.id) as db:
            try:
                db.add(user);db.flush()
                from app.database.seed import seed
                seed(db,user_id=user.id,name=name,force=True)
                db.commit()
            except IntegrityError:
                db.rollback();raise HTTPException(409,'That username is already taken. Choose another.') from None
        response=issue_session(user);response.status_code=201
        return response

    @app.post('/api/auth/logout')
    def auth_logout(request:Request):
        token=request.cookies.get(COOKIE)
        if token:
            with Session(unscoped=True) as db:
                db.execute(delete(AuthSession).where(AuthSession.id==token_digest(token)));db.commit()
        response=JSONResponse({'authenticated':False})
        response.delete_cookie(COOKIE,path='/',secure=settings.app_env=='production',httponly=True,samesite='strict')
        return response

    @app.get('/api/auth/usage')
    def auth_usage(request:Request):
        midnight=datetime.now().replace(hour=0,minute=0,second=0,microsecond=0)
        with Session(unscoped=True) as db:
            used=db.scalar(select(func.count()).select_from(AIUsage).where(AIUsage.created_at>=midnight,AIUsage.user_id==request.state.user.id))
        return {'used':used,'limit':settings.ai_requests_per_user_day,'resets':'midnight in the server timezone'}
