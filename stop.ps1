$pidFile = Join-Path $PSScriptRoot 'backend\data\server-pids.json'
if (Test-Path -LiteralPath $pidFile) {
    foreach ($serverPid in @(Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
        if ($process -and ($process.CommandLine -match 'uvicorn app.main:app|node_modules/vite/bin/vite.js')) {
            Stop-Process -Id $serverPid -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $pidFile
}
Write-Host 'Intellora servers stopped.'
