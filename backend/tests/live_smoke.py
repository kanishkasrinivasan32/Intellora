"""Opt-in integration check using a real configured provider and isolated data.
Run: python tests/live_smoke.py. This uses API credits when Sarvam is active.
"""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATA_DIR'] = tempfile.mkdtemp(prefix='intellora-live-check-')
from fastapi.testclient import TestClient
from app.main import app

report = []
def record(label, result):
    assert result, label
    report.append(label)
    print(f'PASS: {label}', flush=True)

with TestClient(app) as client:
    text = '''# Retrieval Practice
Retrieval practice means trying to recall information from memory before looking at the answer. It strengthens long-term learning more effectively than passive rereading alone. Feedback corrects mistakes after a recall attempt.

# Spaced Repetition
Spaced repetition schedules review over increasing intervals. Intellora uses these intervals: a wrong answer returns tomorrow; the first correct recall returns in three days; the second in seven days; the third in fourteen days; later correct recalls in thirty days. These are product rules, not a universal scientific schedule.

# The Study Routine
The Coral study routine has the unique code CORAL-742. The routine is: read a concept, close the material, recall it, compare with the source, and revisit it later. The routine has exactly five steps. A learner should explain an idea using their own words and use a worked example to check understanding.
'''
    response = client.post('/api/resources/upload',data={'topic':'Retrieval Practice'},files={'file':('study-guide.md',text.encode(),'text/markdown')})
    record('Real upload and local embedding',response.status_code == 201)
    source=client.get('/api/resources/'+response.json()['id']).json()
    record('Chroma indexing finished',source['status']=='ready')
    response=client.post('/api/tutor/ask',json={'question':'What is the unique code for the Coral study routine, and how many steps does it have?','topic':'Retrieval Practice'})
    if response.status_code != 200 or 'CORAL-742' not in response.json().get('answer',''): print('Tutor diagnostic:', response.status_code, response.json(), flush=True)
    record('Sarvam grounded answer includes the source-only fact',response.status_code==200 and 'CORAL-742' in response.json()['answer'] and bool(response.json()['citations']))
    response=client.post('/api/flashcards/generate',json={'topic':'Retrieval Practice','count':3})
    record('Live AI flashcard generation',response.status_code==200 and len(response.json())>0)
    card=response.json()[0]
    record('Generated card review persisted',client.post('/api/flashcards/'+card['id']+'/answer',json={'correct':True}).status_code==200)
    response=client.post('/api/quizzes/generate',json={'topic':'Retrieval Practice','count':3})
    record('Live AI quiz generation',response.status_code==200 and len(response.json()['questions'])>0)
    quiz=response.json()
    response=client.post('/api/quizzes/'+quiz['id']+'/submit',json={'answers':{q['id']:0 for q in quiz['questions']}})
    record('Generated quiz graded and stored',response.status_code==200 and response.json()['submitted'])
    response=client.post('/api/courses/generate',json={'topic':'Retrieval Practice'})
    if response.status_code != 200: print(response.json(),flush=True)
    record('Live course generation with lessons and linked practice',response.status_code==200 and response.json()['lesson_count']>=1)
    record('Progress and reminders available',client.get('/api/progress').json()['xp']>0 and client.get('/api/reminders').status_code==200)

Path(__file__).resolve().parents[2].joinpath('docs','live-check.txt').write_text('\n'.join('PASS: '+x for x in report)+'\n', encoding='utf-8')
print('Live checks completed. All test data stayed in an isolated temporary data directory.',flush=True)
