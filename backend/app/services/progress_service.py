from datetime import date, timedelta
from sqlalchemy import select
from app.models.entities import Progress, StudySession, Reminder

def review_schedule(correct, streak):
    streak = streak + 1 if correct else 0
    days = (3 if streak == 1 else 7 if streak == 2 else 14 if streak == 3 else 30) if correct else 1
    return streak, min(100, streak * 25), date.today() + timedelta(days=days)

def record_activity(db, topic, kind, xp=0, correct=None, concept=None):
    db.add(StudySession(topic=topic, kind=kind, xp=xp))
    progress = db.scalar(select(Progress).where(Progress.topic == topic))
    if not progress:
        progress = Progress(topic=topic, cards_attempted=0, cards_correct=0, mastery_score=0, weak_concepts=[])
        db.add(progress)
    if correct is not None:
        progress.cards_attempted += 1
        progress.cards_correct += int(correct)
        progress.mastery_score = round(100 * progress.cards_correct / progress.cards_attempted)
        weak = set(progress.weak_concepts or [])
        if concept:
            if correct: weak.discard(concept)
            else: weak.add(concept)
        progress.weak_concepts = sorted(weak)
        progress.next_revision = date.today() + timedelta(days=3 if correct else 1)
        reminder = db.scalar(select(Reminder).where(Reminder.topic == topic))
        if not reminder: reminder = Reminder(topic=topic); db.add(reminder)
        reminder.message = f'Revisit {topic} and strengthen your recall'
        reminder.due = progress.next_revision
    return progress
