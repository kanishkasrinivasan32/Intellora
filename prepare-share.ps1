param([string]$OutputDirectory = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $outputRoot "Intellora-friend-$timestamp.zip"
$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ("intellora-share-" + [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $stagingRoot 'Intellora'

New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
try {
    foreach ($file in @('README.md', 'FRIEND_SETUP.md', 'start.ps1', 'start.sh', 'stop.ps1')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $packageRoot
    }

    $backendTarget = Join-Path $packageRoot 'backend'
    New-Item -ItemType Directory -Path $backendTarget -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend\app') -Destination $backendTarget -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend\tests') -Destination $backendTarget -Recurse
    foreach ($file in @('.env.example', 'requirements.txt', 'requirements.lock.txt')) {
        $source = Join-Path $projectRoot "backend\$file"
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $backendTarget }
    }

    $frontendTarget = Join-Path $packageRoot 'frontend'
    New-Item -ItemType Directory -Path $frontendTarget -Force | Out-Null
    foreach ($folder in @('src', 'public')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot "frontend\$folder") -Destination $frontendTarget -Recurse
    }
    foreach ($file in @('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts')) {
        $source = Join-Path $projectRoot "frontend\$file"
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $frontendTarget }
    }

    if (Test-Path -LiteralPath $archivePath) { throw "Refusing to overwrite existing archive: $archivePath" }
    Compress-Archive -Path (Join-Path $packageRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal
}
finally {
    if ($stagingRoot.StartsWith([IO.Path]::GetTempPath(), [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $stagingRoot)) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Safe friend package created: $archivePath"
Write-Host 'Excluded: backend/.env, backend/data, virtual environments, node_modules, uploads, notes, history, and local models.'
