from datetime import date, timedelta
import io
from app.services.progress_service import review_schedule
from app.rag.chunker import chunk_text

def test_chunk_boundaries_and_overlap():
    words = [f'word{i}' for i in range(1000)]
    chunks = chunk_text(' '.join(words), 100, 10)
    assert all(len(c.split()) <= 100 for c in chunks)
    assert chunks[0].split()[-10:] == chunks[1].split()[:10]
    assert set(words) <= set(' '.join(chunks).split())

def test_review_schedule():
    assert review_schedule(False, 4) == (0, 0, date.today()+timedelta(days=1))
    assert review_schedule(True, 0) == (1, 25, date.today()+timedelta(days=3))
    assert review_schedule(True, 1)[2] == date.today()+timedelta(days=7)
    assert review_schedule(True, 2)[2] == date.today()+timedelta(days=14)
    assert review_schedule(True, 3)[2] == date.today()+timedelta(days=30)

def test_upload_retrieve_grounded_answer_delete(client, monkeypatch):
    response = client.post('/api/resources/upload', data={'topic': 'Navigation'}, files={'file': ('navigation.txt', b'The silver compass points toward the lighthouse. The harbor code is CORAL-742.', 'text/plain')})
    assert response.status_code == 201
    id = response.json()['id']
    source = client.get(f'/api/resources/{id}').json()
    assert source['status'] == 'ready' and source['chunks'] >= 1
    matches = client.get('/api/knowledge/search', params={'q':'harbor code','topic':'Navigation'}).json()
    assert matches and 'CORAL-742' in matches[0]['content']
    from app.services import llm_service
    def grounded(prompt, system, task):
        assert 'CORAL-742' in prompt
        return 'The harbor code is CORAL-742 [1].'
    monkeypatch.setattr(llm_service, 'generate', grounded)
    reply = client.post('/api/tutor/ask',json={'question':'What is the harbor code?','topic':'Navigation'})
    assert reply.status_code == 200
    assert reply.json()['grounded'] and reply.json()['citations'][0]['source_id'] == id
    assert client.delete(f'/api/resources/{id}').status_code == 200
    assert client.get('/api/knowledge/search',params={'q':'harbor','topic':'Navigation'}).json() == []

def test_pdf_upload(client):
    import fitz
    doc = fitz.open(); page = doc.new_page(); page.insert_text((72,72), 'Photosynthesis converts light energy into chemical energy.')
    response = client.post('/api/resources/upload', files={'file':('biology.pdf',doc.tobytes(),'application/pdf')},data={'topic':'Biology'})
    id=response.json()['id']; source=client.get(f'/api/resources/{id}').json()
    assert source['status']=='ready'
    assert 'Photosynthesis' in source['content']
    client.delete(f'/api/resources/{id}')

def test_reject_bad_upload_and_private_url(client):
    assert client.post('/api/resources/upload',files={'file':('bad.exe',b'x')}).status_code == 415
    assert client.post('/api/resources/upload',files={'file':('empty.txt',b'')}).status_code == 400
    assert client.post('/api/resources/url',json={'url':'http://127.0.0.1/secret'}).status_code == 400

def test_flashcard_and_progress(client):
    card=client.get('/api/flashcards/due').json()[0]
    before=client.get('/api/progress').json()['xp']
    response=client.post(f'/api/flashcards/{card["id"]}/answer',json={'correct':True})
    assert response.status_code==200
    assert response.json()['mastery_score']==25
    assert response.json()['next_review']==(date.today()+timedelta(days=3)).isoformat()
    assert client.get('/api/progress').json()['xp']==before+15

def test_quiz_hides_answers_and_grades_once(client):
    quiz=client.get('/api/quizzes').json()[0]
    assert all('correct_index' not in q for q in quiz['questions'])
    assert client.post(f'/api/quizzes/{quiz["id"]}/submit',json={'answers':{}}).status_code==422
    answers={q['id']:0 for q in quiz['questions']}
    response=client.post(f'/api/quizzes/{quiz["id"]}/submit',json={'answers':answers})
    assert response.status_code==200
    assert all('correct_index' in q for q in response.json()['questions'])
    assert client.post(f'/api/quizzes/{quiz["id"]}/submit',json={'answers':answers}).status_code==409

def test_lesson_completion_idempotent(client):
    course=client.get('/api/courses').json()[0]; lesson=course['lessons'][0]
    before=client.get('/api/progress').json()['xp']
    for _ in range(2): assert client.post(f'/api/lessons/{lesson["id"]}/complete').status_code==200
    assert client.get('/api/progress').json()['xp']==before+50

def test_notes_persist_and_delete(client):
    note=client.post('/api/notes',json={'title':'My note','content':'A thought'}).json()
    assert client.put(f'/api/notes/{note["id"]}',json={'title':'Updated','content':'Still here'}).status_code==200
    assert any(n['content']=='Still here' for n in client.get('/api/notes').json())
    assert client.delete(f'/api/notes/{note["id"]}').status_code==200

def test_new_chat_preserves_previous_conversation(client):
    first = client.post('/api/tutor/conversations').json()
    reply = client.post('/api/tutor/ask', json={'question':'hi', 'conversation_id':first['id']})
    assert reply.status_code == 200 and reply.json()['conversation_id'] == first['id']
    second = client.post('/api/tutor/conversations').json()
    conversations = client.get('/api/tutor/conversations').json()
    assert {first['id'], second['id']} <= {item['id'] for item in conversations}
    messages = client.get(f'/api/tutor/conversations/{first["id"]}').json()
    assert [message['role'] for message in messages] == ['user', 'assistant']

def test_captain_profile_setup(client):
    before = client.get('/api/profile')
    assert before.status_code == 200
    saved = client.put('/api/profile', data={'name':'Test Captain'})
    assert saved.status_code == 200
    assert saved.json()['name'] == 'Test Captain' and saved.json()['completed'] is True

def test_model_pull_progress(monkeypatch):
    from app.services import llm_service as llm
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'models':[]}
        def iter_lines(self): return iter(['{"status":"downloading","completed":5,"total":10}','{"status":"success"}'])
        def __enter__(self): return self
        def __exit__(self,*args): pass
    class Client(Response):
        def __init__(self,*args,**kwargs): pass
        def get(self,*args,**kwargs): return Response()
        def stream(self,*args,**kwargs): return Response()
    monkeypatch.setattr(llm.httpx,'Client',Client)
    llm.ensure_model('test-model')
    assert llm.status['state']=='ready'
    assert 'test-model' in llm.status['message']

def test_sarvam_fallback_and_no_key(monkeypatch):
    from app.services import llm_service as llm
    import httpx
    monkeypatch.setitem(llm.runtime,'provider','auto')
    monkeypatch.setattr(llm.settings,'gemini_api_key','')
    monkeypatch.setattr(llm.settings,'sarvam_api_key','test-only')
    def unavailable(*a): raise httpx.ConnectError('offline')
    monkeypatch.setattr(llm,'ensure_model',unavailable)
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'choices':[{'message':{'content':'fallback works'}}]}
    monkeypatch.setattr(llm.httpx,'post',lambda *a,**k:Response())
    assert llm.generate('hi','tutor')=='fallback works'
    monkeypatch.setattr(llm.settings,'sarvam_api_key','')
    import pytest
    with pytest.raises(llm.ProviderError): llm.generate('hi','tutor')

def test_gemini_provider(monkeypatch):
    from app.services import llm_service as llm
    monkeypatch.setitem(llm.runtime,'provider','gemini')
    monkeypatch.setattr(llm.settings,'gemini_api_key','test-only')
    monkeypatch.setattr(llm.settings,'gemini_model','gemini-test')
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'candidates':[{'content':{'parts':[{'text':'Gemini works'}]}}]}
    def request(url, headers, json, timeout):
        assert url.endswith('/gemini-test:generateContent')
        assert headers['x-goog-api-key'] == 'test-only'
        return Response()
    monkeypatch.setattr(llm.httpx,'post',request)
    assert llm.generate('hi','system','tutor') == 'Gemini works'

def test_auto_uses_gemini_first_for_structured_generation(monkeypatch):
    from app.services import llm_service as llm
    monkeypatch.setitem(llm.runtime,'provider','auto')
    monkeypatch.setattr(llm,'_gemini_generate',lambda *args:'structured with Gemini')
    monkeypatch.setattr(llm,'_ollama_generate',lambda *args,**kwargs:(_ for _ in ()).throw(AssertionError('local should not run first')))
    assert llm.generate('build a syllabus','system','course') == 'structured with Gemini'

def test_generated_course_links_artifacts(client,monkeypatch):
    from app.agents import course_agent
    from app.models.schemas import CoursePlan, CompleteLessonDraft, FlashcardBatch, QuizBatch, CoverageAudit
    monkeypatch.setattr(course_agent,'_research',lambda *args:None)
    def generated(schema,*args,**kwargs):
        if schema is CoursePlan:
            return schema.model_validate({'title':'Ocean Science','description':'Understand tides and the physical systems that shape the ocean.','lessons':[{'title':f'Ocean lesson {i}','module':'Foundations','objective':f'Understand ocean concept number {i} in practical detail.','prerequisites':[]} for i in range(8)]})
        if schema is CompleteLessonDraft:
            content=' '.join(['Tides are shaped by gravity, coastlines, depth, and the motion of ocean water.']*45)
            return schema.model_validate({'title':'Tides','objective':'Understand how tidal forces produce predictable sea-level changes.','content':content,'worked_example':' '.join(['A harbor prediction compares lunar position and local observations step by step.']*20),'practice_exercises':['Explain spring tides.','Compare two harbors.'],'source_chunk_ids':[]})
        if schema is FlashcardBatch:
            return schema.model_validate({'cards':[{
                'question':f'Tide pattern {i}', 'answer':'Gravity and local geography shape the observed tidal pattern.',
                'subtopic':'Tides', 'explanation':'The Moon and Sun create tidal forces, while coastline shape and water depth modify the timing and height observed at a harbor. Local measurements are therefore combined with astronomical cycles when predictions are prepared.',
                'key_points':['The Moon supplies the strongest tidal influence.','The Sun changes spring and neap tide strength.','Local geography modifies the observed pattern.'],
                'worked_example':'Compare two harbors on the same day: different basin shapes can produce different high-tide times even under the same lunar forcing.'
            } for i in range(5)]})
        if schema is QuizBatch:
            return schema.model_validate({'questions':[{'question':f'Which factor affects tides {i}?','options':['Moon','Mars'],'correct_index':0,'explanation':'The nearby Moon exerts a strong tidal influence.'} for i in range(5)]})
        if schema is CoverageAudit: return schema.model_validate({'missing_subtopics':[],'is_complete':True})
        raise AssertionError(schema)
    monkeypatch.setattr(course_agent,'generate_validated',generated)
    response=client.post('/api/courses/generate',json={'topic':'Ocean Science'})
    assert response.status_code==202
    job=client.get(f'/api/courses/jobs/{response.json()["id"]}').json(); assert job['status']=='done'
    course=client.get(f'/api/courses/{job["course_id"]}').json(); assert course['lesson_count']==8
    assert any(c['course_id']==course['id'] for c in client.get('/api/flashcards').json())
    assert any(q['course_id']==course['id'] for q in client.get('/api/quizzes').json())
    assert client.delete(f'/api/courses/{course["id"]}').status_code==200
    assert all(c.get('course_id')!=course['id'] for c in client.get('/api/flashcards').json())
    assert all(q.get('course_id')!=course['id'] for q in client.get('/api/quizzes').json())
    assert all(t['name']!='Ocean Science' for t in client.get('/api/knowledge/topics').json())

def test_invalid_generation_does_not_store(client,monkeypatch):
    from app.agents import learning
    monkeypatch.setattr(learning,'context_for',lambda topic:([],''))
    monkeypatch.setattr(learning,'generate_json',lambda *a:{'questions':[{'question':'Invalid','options':['One','Two'],'correct_index':99,'explanation':'Bad'}]})
    before=len(client.get('/api/quizzes').json())
    assert client.post('/api/quizzes/generate',json={'topic':'Invalid'}).status_code==503
    assert len(client.get('/api/quizzes').json())==before

def test_settings_never_expose_key(client):
    data=client.get('/api/settings/models').json()
    assert 'sarvam_api_key' not in data
    assert 'sarvam_configured' in data

def test_edit_card_resets_schedule(client):
    card=client.get('/api/flashcards').json()[0]
    response=client.put(f'/api/flashcards/{card["id"]}',json={'question':'What is a Python variable?','answer':'A name that refers to a value.'})
    assert response.status_code==200
    assert response.json()['mastery_score']==0
    assert response.json()['next_review']==date.today().isoformat()

def test_failed_embedding_migration_preserves_index(client,monkeypatch):
    from app.rag import vector_store as vectors
    from app.services import llm_service as llm
    before=vectors.collection().name
    prior_model=llm.runtime['models']['embedding']
    def fail(model): raise ConnectionError('Ollama unavailable')
    monkeypatch.setattr(vectors,'ensure_model',fail)
    vectors.migrate_embedding('different-model')
    assert vectors.collection().name==before
    assert llm.runtime['models']['embedding']==prior_model
    assert vectors.status['state']=='error'

def test_research_sources_are_deduplicated(client,monkeypatch):
    from app.agents import research
    import app.main as main
    monkeypatch.setattr(research,'find_sources',lambda topic:[{'title':'Research fixture','url':'https://example.org/fixture'}])
    monkeypatch.setattr(main,'process_source',lambda *args:None)
    first=client.post('/api/resources/research',json={'topic':'Fixture'}).json()
    second=client.post('/api/resources/research',json={'topic':'Fixture'}).json()
    assert first[0]['id']==second[0]['id']
