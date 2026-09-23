$pidFile = Join-Path $PSScriptRoot 'backend\data\server-pids.json'
$rootPattern = [regex]::Escape($PSScriptRoot)
$ownedProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match $rootPattern -and $_.CommandLine -match 'uvicorn app.main:app|vite[\\/]bin[\\/]vite.js'
})
foreach ($ownedProcess in $ownedProcesses) {
    Stop-Process -Id $ownedProcess.ProcessId -Force -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile }
Write-Host 'Intellora servers stopped.'
