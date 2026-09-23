# Intellora — your local-first learning voyage

A local-first AI learning companion created by [Kanishka Srinivasan](https://github.com/kanishkasrinivasan32) and [Thiso Vallaba Dass](https://github.com/ThisoVallabaDass). It combines React, FastAPI, SQLite, persistent retrieval, local Ollama models, optional cloud providers, interactive courses, quizzes, notes, and the Grand Line knowledge map.

> Your learning data stays on your computer by default. Cloud AI is optional and uses only API keys that you configure yourself.

## Run on Windows

From this directory:

```powershell
.\start.ps1
```

If PowerShell blocks local script execution, invoke this script without changing your system policy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

The script creates a virtual environment, installs dependencies when requirements change, starts both servers hidden, waits for them, and opens Chrome (or your default browser if Chrome is absent).

- App: <http://localhost:5173>
- API documentation: <http://127.0.0.1:8000/docs>
- Stop both servers: `./stop.ps1`
- Start without opening a browser: `./start.ps1 -NoBrowser`
- macOS/Linux or Git Bash: `bash start.sh`. On Unix, Ctrl+C stops both processes.
- Requires Python 3.11+ and Node.js 20.19+ or 22.12+. Verified here with Python 3.13 and Node 24.

## Install from GitHub

```powershell
git clone https://github.com/kanishkasrinivasan32/Intellora.git
cd Intellora
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Before starting, install Python 3.11+, Node.js 20+, and [Ollama](https://ollama.com/download), then run `ollama pull qwen2.5:3b`. Intellora will also detect available memory and guide you toward a suitable 3B or 8B model.

## Give Intellora to a friend

Create a privacy-safe ZIP from the project folder:

```powershell
.\prepare-share.ps1
```

The archive contains the app and setup instructions, but excludes your `backend/.env`, private database, uploads, notes, learning history, virtual environment, dependencies, and local models. Send the generated `Intellora-friend-*.zip` together with [FRIEND_SETUP.md](FRIEND_SETUP.md). Your friend installs Python, Node.js, and Ollama, runs `ollama pull qwen2.5:3b`, then starts the app with `start.ps1`. Never copy your own API key into their package.

Both development servers bind only to `127.0.0.1`. Do not expose a local installation through an untrusted public tunnel.

## Start exploring

1. **Add knowledge:** upload a file, enter a public website/YouTube URL, or use Research to find up to three Wikipedia articles for a topic. Processing status and errors appear in the library. Failed sources can be retried.
2. **AI first mate:** ask a question. Relevant uploaded passages become numbered citations, and you can inspect the underlying source. Without a relevant source, the tutor is instructed to label its answer as general knowledge.
3. **My courses:** start one of the three handcrafted starter courses or generate a complete course. Generation runs in the background and shows research, syllabus, per-lesson writing, practice generation and coverage-audit progress. Broad courses normally contain 8–20 lessons; every completed lesson receives at least five flashcards and five quiz questions.
4. **Flashcards:** recall before flipping; choose “Still learning” or “Got it.” Edit a card to make the wording your own. Editing resets its schedule.
5. **Quizzes:** answer every question before submitting. Grading occurs on the server; answers are withheld until submission. A submitted quiz cannot award XP again.
6. **Visual learning:** every course lesson includes one interactive “See it happen” diagram. Click a diagram node to read its explanation and navigate to the related lesson content. The Grand Line Map provides drag-and-zoom relationships across topics and notes.
7. **Captain’s notes:** write and save Markdown notes, or save a tutor response as a note.
8. **My progress:** view real XP, daily streaks, lesson completions and practice accuracy. Starter content never seeds fake activity or achievements.

All three starter courses have complete written lessons: Python, Machine Learning and SQL. They are introductory general-knowledge content, not generated from your files.

## AI configuration

No API key is included in this repository. Add your own optional Gemini, OpenRouter, Groq, or Sarvam key in Ship Settings. Keys are encrypted at rest and are never returned to the browser. `backend/.env.example` contains only safe placeholders.

```env
LLM_PROVIDER=auto
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest
SARVAM_API_KEY=
SARVAM_MODEL=sarvam-105b
TUTOR_MODEL=qwen2.5:3b
FLASHCARD_MODEL=qwen2.5:3b
QUIZ_MODEL=qwen2.5:3b
COURSE_MODEL=qwen2.5:3b
RESEARCH_MODEL=qwen2.5:3b
VISUALIZER_MODEL=qwen2.5:3b
EMBED_MODEL=nomic-embed-text
```

In `auto` mode, every AI task tries local Ollama first. Configured cloud providers are fallbacks. Selecting Ollama explicitly prevents cloud fallback. Ollama itself is not installed by this project: install it from [ollama.com](https://ollama.com/) and pull the recommended model.

## Creators and license

Intellora is jointly created by Kanishka Srinivasan and Thiso Vallaba Dass. See [CONTRIBUTORS.md](CONTRIBUTORS.md). The project is available under the [MIT License](LICENSE), whose copyright notice names both creators.

Sarvam requests use `/v1/chat/completions`, `api-subscription-key`, and `sarvam-105b`, following the [official V1 API documentation](https://docs.sarvam.ai/api-reference/chat/chat-completions-v1). JSON artifacts request JSON mode and are validated with Pydantic before saving. Reasoning is disabled to avoid spending the response budget on hidden reasoning for these bounded learning tasks. Transient network, rate-limit and server errors retry twice; permanent authentication errors do not. Cloud use consumes your Sarvam account credits.

**Local embeddings:** use Ollama when available. Otherwise Chroma's ONNX MiniLM model runs locally on CPU, with a one-time approximately 80 MB model download. This is the same MiniLM family used by sentence-transformers, without requiring a large PyTorch installation. No embedding content is sent to Sarvam. The selected embedding backend is persisted so query/document vectors cannot accidentally mix. Changing the embedding model builds a separate index through Ollama, switches only after success, and retains the old index if preparation fails. Old successful index versions remain on disk for manual backup/recovery.

Relevant source excerpts and recent conversation turns leave your machine only when you use cloud generation. Local fonts, artwork, starter lessons, notes and practice work offline; cloud AI, first-time model downloads and web research require internet access.

## Sound deck and artwork

Sounds start muted. Enable the speaker toggle, then open **Settings & sound**. Original short Web Audio cues can play after a correct answer, wrong answer, quiz/course completion or level-up. Nothing plays when a course, lesson, flashcard or quiz opens, and the learning flow contains no video popup or third-party show clips. Sound behavior is centralized in `frontend/src/lib/sounds.ts`.

The hero is an original built-in ImageGen illustration saved at `frontend/public/assets/grand-line.png`. The straw hat and compass are small original SVG graphics; UI icons come from Lucide (ISC). No background removal was necessary for these assets. Fonts are self-hosted DM Sans and DM Serif Display with their OFL license files in `frontend/public/fonts`. See [artwork generation prompt](docs/ARTWORK.md).

## Ingestion details

Supported: TXT, Markdown, PDF (PyMuPDF), DOCX, CSV, JSON, PNG/JPEG/WebP, Python, SQL, Jupyter notebooks, public websites, YouTube captions.

- Upload limit: 25 MB. Parsed text: 2 million characters. Web response: 5 MB.
- CSV uses the standard library, and notebooks use JSON directly; this keeps installation smaller while preserving cells and text outputs. Format readers are grouped into one module rather than adding many trivial wrapper modules.
- Image OCR requires the separate Tesseract executable on `PATH`. Missing Tesseract produces an actionable resource error. Scanned PDFs require prior OCR; no claim is made that image-only PDFs can be read as text.
- YouTube ingestion reads publicly accessible captions and timestamps; it does not download video or audio. Captions can be absent or blocked by YouTube. Upload a transcript in that case.
- Website ingestion checks robots.txt and follows only public redirects. It does not bypass authentication or paywalls. Respect a publisher's terms when adding a source.
- Topic retrieval uses exact topic names; use the same topic when uploading and generating from those sources. Documents are paragraph/heading-aware chunked, embedded, searched by cosine distance and reranked with lexical overlap. Source IDs are attached to generated artifacts.
- Research uses Wikipedia's public search API and then the same website ingestion pipeline. It can fail visibly if that service is blocked or unavailable.

## Implementation and storage

`backend/app/main.py` exposes the specified resource, knowledge, tutor, course, flashcard, quiz, progress, reminder and settings routes under `/api`; unprefixed aliases are also available. `POST /api/courses/generate` returns a background job, and `GET /api/courses/jobs/{id}` exposes its durable progress log, partial-course ID and actionable error. Additional routes cover notes, lesson completion, research, visualization and live status. `/docs` is the full generated contract.

SQLite contains users, topics, sources, documents, chunk metadata, course-generation jobs, courses, lessons, flashcards, quizzes, questions, user answers, progress, sessions, reminders, notes and chat history. Chroma data is persistent. All user data is in `backend/data/`; back up that folder with the servers stopped. Uploaded filenames are never used as disk paths.

Agents are explicit Python services: research, course/knowledge architect, tutor, flashcards, quiz, deterministic evaluator and visualizer. Course generation is a staged, resumable workflow: public research and ingestion, 8–20 lesson planning, one validated lesson/card/quiz batch at a time, then a strict coverage audit and gap-fill pass. Invalid artifacts are automatically regenerated with validation feedback; completed lessons remain saved if a later lesson exhausts its retries. Database tables initialize with SQLAlchemy `create_all`; future schema changes need an explicit migration before using existing data.

Spaced review intervals: wrong → 1 day; correct streak 1 → 3 days; 2 → 7; 3 → 14; 4+ → 30. Progress “mastery” is practice accuracy, not a scientific estimate of long-term proficiency. Reminders appear inside the app; no background OS notification service is installed. XP: tutor interaction 5, lesson 50, correct flashcard 15, incorrect flashcard 5, correct quiz answer 20, incorrect quiz answer 5. Daily goal: 100 XP.

## Verification

```powershell
cd backend
.venv/Scripts/python -m pytest -q
cd ../frontend
npm run build
```

Automated tests use isolated temporary databases and deterministic test embeddings; provider calls are mocked. They exercise source upload/retrieval/deletion, PDFs, grounding/citations, missing model pulls, cloud fallback/no-key behavior, scheduling, grading, idempotent lesson completion, notes, artifact validation and secret-free settings.

An opt-in live integration check uses real embeddings and the configured provider, in an isolated temporary data directory. It consumes cloud credits if Sarvam is used:

```powershell
cd backend
.venv/Scripts/python tests/live_smoke.py
```

The completed live report is saved to `docs/live-check.txt`. Browser verification covers desktop and 390px mobile layouts, navigation, flashcard reveal, dialogs and the knowledge graph. Real Ollama downloads require an installed/running Ollama and were not exercised on this machine; the pull protocol is covered by automated tests.

`frontend/package-lock.json` pins frontend dependencies. `backend/requirements.lock.txt` records the exact installed Python environment for reproducibility; `requirements.txt` holds the direct supported ranges. The graph library is loaded only when opening the map; its separate build chunk is larger than Vite's advisory 500 kB threshold.

## Troubleshooting

- Logs: `backend/data/backend-error.log`, `backend.log`, `frontend-error.log`, `frontend.log`.
- Backend offline: run the launch script; existing healthy servers are reused.
- Model download: keep Ollama running and wait for the progress message. Large local models can require several GB.
- Sarvam 401/403: check the key in `backend/.env`, then restart the backend. For 429/credit issues, check your provider account.
- Failed source: inspect its error in the library, fix the input/dependency, and click Retry.
- After changing Python code or `.env`, run `stop.ps1`, then `start.ps1`. Vite reloads frontend edits automatically.
- Source code never includes a real key; do not copy `backend/.env` into public deployments or shared archives.
