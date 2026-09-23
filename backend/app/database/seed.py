from sqlalchemy import select
from app.models.entities import User, Course, Lesson, Topic, Flashcard, Quiz, QuizQuestion

STARTERS = [
    {'title': 'Python, from the ground up', 'topic': 'Python', 'description': 'Your first port of call. Turn a little curiosity into real, working code.', 'color': 'sea',
     'lessons': [
        ('Meet your first Python program', '''## A small line. A big beginning.
Python is a programming language: a way to give a computer precise instructions. Start with a program that displays a message:

```python
print("Hello, adventure!")
```

`print` is a function. The text in quotes is a **string**, and the parentheses pass that string to the function. Python runs instructions from top to bottom.

### Give a value a name
A variable is a name that refers to a value. Assignment uses a single `=`.

```python
captain = "Kanishka"
islands = 3
print(f"{captain} explored {islands} islands.")
```

Here `captain` refers to a string and `islands` to an integer. An f-string inserts the expressions inside braces into the surrounding text. Names are case-sensitive: `islands` and `Islands` are different.

### Your turn
Create a variable named `goal` with a skill you want to learn. Print a sentence containing it. Then create `days = 7` and print `days * 20` to calculate a week of twenty-minute study sessions.

**Remember:** `=` assigns a value. `==` compares two values. Confusing them is a common early mistake.'''),
        ('Make decisions and repeat actions', '''## Let your code choose a course
An `if` statement runs a block only when its condition is true. Python uses indentation to define blocks.

```python
score = 80
if score >= 70:
    print("Ready for the next island")
else:
    print("A little more practice")
```

Use four spaces consistently. A colon begins the indented block. You can combine conditions using `and`, `or`, and `not`.

### Repeat with a loop
A `for` loop visits each item in an iterable such as a list.

```python
topics = ["variables", "conditions", "loops"]
for topic in topics:
    print(f"Practice {topic}")
```

`range(3)` produces 0, 1, and 2; its stop value is excluded. A `while` loop repeats while a condition remains true. Make sure something changes the condition, or the loop may never end.

### Your turn
Loop over `[45, 92, 68, 81]`. Print `pass` for each score at least 70 and `practice` otherwise. How many passes should you see? Work it out before running the code.'''),
        ('Build reusable functions', '''## Pack an idea into a function
A function names a reusable operation. Parameters receive inputs; `return` sends a result back to the caller.

```python
def study_minutes(days, minutes_per_day=20):
    return days * minutes_per_day

weekly_total = study_minutes(7)
print(weekly_total)  # 140
```

`minutes_per_day` has a default argument. `study_minutes(7, 30)` overrides that default and returns 210. Variables defined inside a function normally belong to its local scope.

### Return versus print
Printing displays a value, but does not make it available as the function's result. A function without an explicit return value returns `None`.

```python
def is_ready(score):
    return score >= 70

assert is_ready(70) is True
assert is_ready(69) is False
```

### Your turn
Write `average(scores)` that returns the mean of a nonempty list. Decide what should happen for an empty list: raising `ValueError` is one clear choice. Check ordinary inputs and the edge case. Small functions with clear inputs and outputs are easier to test and reuse.''')],
     'cards': [('What does = do in Python?', 'It assigns a value to a name. Use == to compare values.', 'Variables'), ('What values does range(3) produce?', '0, 1, and 2. The stop value is excluded.', 'Loops'), ('How does return differ from print?', 'return gives a result to the caller; print displays output. Without return, a function returns None.', 'Functions')],
     'questions': [('What does print(3 * 4) display?', ['7', '12', '34', '3 * 4'], 1, 'The * operator multiplies the two integers.', 'Variables'), ('How many times does for i in range(3) iterate?', ['2', '3', '4', 'Forever'], 1, 'range(3) yields three values: 0, 1 and 2.', 'Loops'), ('Which keyword sends a function result back to the caller?', ['print', 'yielding', 'return', 'result'], 2, 'return ends the function and provides its result.', 'Functions')]},
    {'title': 'The world of machine learning', 'topic': 'Machine Learning', 'description': 'Find the patterns. Understand the predictions. Make sense of machine learning.', 'color': 'sand',
     'lessons': [
        ('Learning from examples', '''## When examples become a model
Machine learning fits patterns from data instead of requiring a hand-written rule for every situation. In **supervised learning**, each training example includes inputs (features) and a known target (label).

Imagine predicting a home's price from its size. Size is a feature; price is the target. A regression model predicts a numeric value. A classification model predicts a category, such as whether an email is spam.

### Training is not evaluation
Training adjusts the model using training data. Evaluation checks predictions on examples the model did not train on. A model that memorizes examples may perform well on training data but fail on new cases. This is **overfitting**.

### Your turn
For each task, identify the features, target, and whether it is regression or classification: predicting travel time; detecting a fraudulent transaction; estimating next week's sales. Think about which information would actually be available at prediction time.'''),
        ('Split, train, and evaluate', '''## Keep a fair test
Split data into training, validation, and test sets. Train on the training set, choose settings using validation, and use the test set for a final estimate. Repeatedly using test results to make choices leaks information into development.

### Avoid leakage
Fit preprocessing such as scaling using only training data, then apply the fitted transformation to validation and test data. Time-ordered data often needs a chronological split, and records from the same person may need grouped splits.

### Choose a metric for the goal
For regression, mean absolute error is the average absolute prediction error. For classification, accuracy is the fraction correct. Accuracy can be misleading when one class is rare. Precision measures how many positive predictions are correct; recall measures how many actual positives were found.

**Practice:** a model flags 10 transactions, 8 truly fraudulent. There are 20 actual frauds. Precision is 8/10 = 0.8; recall is 8/20 = 0.4. Which matters more depends on the costs of missed fraud and false alarms.'''),
        ('Generalization and better experiments', '''## Learn the pattern, not the noise
A model generalizes when it performs well on new data from the problem it is intended to solve. More complexity can fit training data more closely while making generalization worse.

Start with a simple baseline. Compare all models using the same evaluation procedure. Regularization discourages overly complex solutions. Cross-validation repeats training and validation across multiple splits, making estimates less dependent on one split.

### A useful experiment log
Record your dataset version, split method, features, model settings, metric, and results. Change one major factor at a time when possible. Do not infer improvement from a tiny difference without considering variability and sample size.

### Your turn
Your training accuracy is 99% and validation accuracy is 65%. This gap suggests overfitting, but also check for distribution differences or preprocessing mistakes. Try a simpler model, stronger regularization, or more representative training data. Keep the final test set untouched until the decisions are made.''')],
     'cards': [('What is supervised learning?', 'Learning a mapping from input features to known target labels using labeled examples.', 'Foundations'), ('What is overfitting?', 'Learning training-specific patterns or noise that do not generalize well to new data.', 'Generalization')],
     'questions': [('Predicting a house price is usually which task?', ['Classification', 'Regression', 'Clustering', 'Tokenization'], 1, 'The target is a continuous numeric value.', 'Foundations'), ('Which data should fit a scaler?', ['All available data', 'Test data only', 'Training data only', 'Validation data only'], 2, 'Fitting on training data prevents leakage from held-out evaluation sets.', 'Evaluation')]},
    {'title': 'SQL: uncover the hidden treasure', 'topic': 'SQL', 'description': 'Ask better questions of your data, one query at a time.', 'color': 'rose',
     'lessons': [
        ('Find your way around a table', '''## Data with a little structure
A relational table stores records in rows and fields in columns. A primary key identifies each row. SQL lets you describe the data you want.

```sql
SELECT name, score
FROM learners
WHERE score >= 70
ORDER BY score DESC;
```

This query selects two columns, filters rows, and sorts the result from highest to lowest score. Without ORDER BY, result order is not guaranteed. Text literals use single quotes, as in `WHERE name = 'Kanishka'`.

### Missing values
NULL represents missing or unknown information. Use `IS NULL` or `IS NOT NULL`, not `= NULL`. Comparisons involving NULL generally produce unknown rather than true or false.

### Your turn
Write a query selecting names from learners whose score is below 70, ordered alphabetically. Then adapt it to find learners whose score has not been recorded.'''),
        ('Group and summarize', '''## Turn rows into insight
Aggregate functions summarize values. `COUNT(*)` counts rows, `SUM` adds values, and `AVG` calculates a mean. Most aggregate functions ignore NULL values; `COUNT(*)` includes every row.

```sql
SELECT topic, COUNT(*) AS attempts, AVG(score) AS average_score
FROM quiz_results
GROUP BY topic
HAVING COUNT(*) >= 3;
```

GROUP BY creates one group per topic. WHERE filters individual rows before grouping; HAVING filters groups after aggregation. Select only grouping keys or aggregate expressions for portable, unambiguous grouped queries.

### Your turn
Calculate the average score per learner, keeping only learners with at least five attempts. Add a WHERE clause to include only attempts after a chosen date. Explain why the attempt-count filter belongs in HAVING.'''),
        ('Connect your data with joins', '''## A relationship between tables
A foreign key refers to another table's key. A JOIN combines rows using a relationship.

```sql
SELECT learners.name, courses.title
FROM learners
JOIN enrollments ON enrollments.learner_id = learners.id
JOIN courses ON courses.id = enrollments.course_id;
```

An INNER JOIN keeps matching rows. A LEFT JOIN keeps every row from the left table and fills unmatched right-side values with NULL. A one-to-many relationship can produce multiple result rows for one left-side record; this is expected.

### A common trap
After a LEFT JOIN, a WHERE condition on the right table can discard unmatched rows. Put conditions in the ON clause when you need to preserve all left-side records.

### Your turn
Write a LEFT JOIN to list all learners and their enrollments, including learners without an enrollment. Then filter for `enrollments.learner_id IS NULL` to find learners who have not enrolled.''')],
     'cards': [('How do WHERE and HAVING differ?', 'WHERE filters rows before grouping; HAVING filters groups after aggregation.', 'Aggregation'), ('What does a LEFT JOIN preserve?', 'All rows from the left table, with NULL values for unmatched right-side columns.', 'Joins')],
     'questions': [('Which clause sorts a query result?', ['GROUP BY', 'ORDER BY', 'HAVING', 'WHERE'], 1, 'ORDER BY defines the result ordering.', 'Queries'), ('How should you check for a missing value?', ['= NULL', '== NULL', 'IS NULL', 'EQUALS NULL'], 2, 'NULL requires IS NULL; equality comparisons do not test missingness.', 'Queries')]}
]

def seed(db, user_id='kanishka', name='Kanishka', force=False):
    if db.info.get('user_id') != user_id or db.info.get('unscoped'):
        raise ValueError('Starter lessons require a session scoped to the new account.')
    existing_user = db.get(User, user_id)
    if not existing_user:
        db.add(User(id=user_id, name=name))
    elif not force:
        # The account itself is the durable initialization marker. This prevents
        # manually deleted starter courses from reappearing after a restart.
        return
    if db.scalar(select(Course.id).limit(1)):
        return
    for item in STARTERS:
        course = Course(title=item['title'], topic=item['topic'], description=item['description'], color=item['color'])
        db.add(course); db.flush()
        hierarchy = []
        for i,(title,content) in enumerate(item['lessons']):
            db.add(Lesson(course_id=course.id, title=title, content=content, position=i, source_chunk_ids=[]))
            hierarchy.append({'name': title, 'prerequisites': [item['lessons'][i-1][0]] if i else []})
        db.add(Topic(name=item['topic'], hierarchy=hierarchy))
        for question, answer, concept in item['cards']:
            db.add(Flashcard(course_id=course.id, topic=item['topic'], subtopic=concept, question=question, answer=answer, source_chunk_ids=[]))
        quiz = Quiz(topic=item['topic'], course_id=course.id, title=f'{item["topic"]} · First expedition')
        db.add(quiz); db.flush()
        for question,options,index,explanation,concept in item['questions']:
            db.add(QuizQuestion(quiz_id=quiz.id, question=question, options=options, correct_index=index, explanation=explanation, concept=concept, source_chunk_ids=[]))
    db.commit()
