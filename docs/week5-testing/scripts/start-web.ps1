$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Set-Location $projectRoot
$temporaryDirectory = Join-Path $projectRoot '.artifacts/week5-environment/tmp'
New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null
$env:TEMP = $temporaryDirectory
$env:TMP = $temporaryDirectory
$env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:58127'
npm.cmd run web -- --localhost --port 58126 --max-workers 2
