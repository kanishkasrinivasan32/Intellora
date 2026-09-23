#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${OS:-}" == "Windows_NT" ]]; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./start.ps1
  exit $?
fi
[[ -d backend/.venv ]] || python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --timeout 120 -r backend/requirements.txt
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -d frontend/node_modules ]] || (cd frontend && npm ci)
(cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
backend_pid=$!
(cd frontend && npm run dev) &
frontend_pid=$!
trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' EXIT INT TERM
python - <<'PY'
import time, urllib.request, webbrowser, shutil, subprocess
for _ in range(60):
    try:
        urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)
        urllib.request.urlopen('http://127.0.0.1:5173', timeout=2)
        break
    except Exception: time.sleep(1)
else: raise SystemExit('Servers failed to start; check terminal output.')
chrome = shutil.which('google-chrome') or shutil.which('chromium')
if chrome: subprocess.Popen([chrome, 'http://localhost:5173'])
else: webbrowser.open('http://localhost:5173')
PY
wait
