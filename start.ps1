param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonExe = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { python -m venv backend/.venv; if ($LASTEXITCODE) { throw 'Python 3.11+ is required.' } }
$requirements = Join-Path $projectRoot 'backend\requirements.txt'
$stamp = Join-Path $projectRoot 'backend\.venv\.requirements-hash'
$currentHash = (Get-FileHash -LiteralPath $requirements).Hash
if (-not (Test-Path -LiteralPath $stamp) -or (Get-Content -LiteralPath $stamp -Raw).Trim() -ne $currentHash) {
    & $pythonExe -m pip install --timeout 120 -r $requirements
    if ($LASTEXITCODE) { throw 'Could not install backend dependencies. Check the network and retry.' }
    Set-Content -LiteralPath $stamp -Value $currentHash
}
if (-not (Test-Path -LiteralPath 'backend\.env')) { Copy-Item -LiteralPath 'backend\.env.example' -Destination 'backend\.env' }
if (-not (Test-Path -LiteralPath 'frontend\node_modules')) {
    Push-Location frontend
    try { npm.cmd ci; if ($LASTEXITCODE) { throw 'Could not install frontend dependencies.' } } finally { Pop-Location }
}
$ollamaReady = $false
try { $ollamaReady = (Invoke-WebRequest 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch {}
if (-not $ollamaReady) {
    $ollamaCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
        (Join-Path $env:LOCALAPPDATA 'Ollama\ollama.exe'),
        (Join-Path $env:ProgramFiles 'Ollama\ollama.exe')
    )
    $ollamaExe = $ollamaCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($ollamaExe) {
        Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 500
            try { if ((Invoke-WebRequest 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { break } } catch {}
        }
    }
}
$logDir = Join-Path $projectRoot 'backend\data'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
function Test-IntelloraHealth {
    try { $response = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; return $response.status -eq 'ok' } catch { return $false }
}
$started = @()
if (-not (Test-IntelloraHealth)) {
    $process = Start-Process -FilePath $pythonExe -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'backend.log') -RedirectStandardError (Join-Path $logDir 'backend-error.log')
    $started += $process.Id
}
$frontendReady = $false
try { $frontendReady = (Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch {}
if (-not $frontendReady) {
    $nodeExe = (Get-Command node.exe).Source
    $process = Start-Process -FilePath $nodeExe -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'frontend.log') -RedirectStandardError (Join-Path $logDir 'frontend-error.log')
    $started += $process.Id
}
$existing = @()
$pidFile = Join-Path $logDir 'server-pids.json'
if (Test-Path -LiteralPath $pidFile) { $existing = @(Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json) }
ConvertTo-Json -InputObject @($existing + $started | Select-Object -Unique) | Set-Content -LiteralPath $pidFile
for ($attempt = 0; $attempt -lt 45; $attempt++) {
    $backendReady = Test-IntelloraHealth
    try { $frontendReady = (Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $frontendReady = $false }
    if ($backendReady -and $frontendReady) { break }
    Start-Sleep -Seconds 1
}
if (-not $backendReady -or -not $frontendReady) { throw 'Servers did not become ready. See backend/data/*-error.log.' }
Write-Host 'Intellora is ready: http://localhost:5173'
if (-not $NoBrowser) {
    $chromeCandidates = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
    $chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($chrome) { Start-Process -FilePath $chrome -ArgumentList 'http://localhost:5173' } else { Start-Process 'http://localhost:5173' }
}
