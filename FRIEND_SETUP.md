# Intellora — friend setup

This copy is designed to run locally. Your friend gets a fresh database and their own AI configuration; your courses, uploads, notes, history, and API keys are not included in the share ZIP.

## Windows

1. Install [Python 3.11 or newer](https://www.python.org/downloads/), [Node.js 20 or newer](https://nodejs.org/), and [Ollama](https://ollama.com/download).
2. Open PowerShell and download the small local model:

   ```powershell
   ollama pull qwen2.5:3b
   ```

3. Extract the Intellora ZIP, open PowerShell in that folder, and run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
   ```

4. Open <http://localhost:5173> if the browser does not open automatically.

The first start creates the Python environment, installs pinned frontend dependencies, creates `backend/.env` from the safe example, and starts both local servers. Later starts reuse what is already installed.

## Optional cloud generation

Local tutoring and generation work through Ollama. For stronger/faster long course generation, your friend can add their own Gemini key to `backend/.env`:

```env
GEMINI_API_KEY=their-own-key
```

They should never paste your key or share that `.env` file. Restart Intellora after changing it.

## Stop Intellora

```powershell
.\stop.ps1
```

## macOS or Linux

Install Python, Node.js, and Ollama, run `ollama pull qwen2.5:3b`, then run `bash start.sh` from the extracted folder.

## Private files that must never be shared

- `backend/.env`
- `backend/data/`
- `backend/.venv/`
- `frontend/node_modules/`
- local model files or Ollama storage

Use `prepare-share.ps1` from the original project folder to create the safe ZIP automatically.
