$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Set-Location $projectRoot
$env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:58127'
npm.cmd run web -- --localhost --port 58126
