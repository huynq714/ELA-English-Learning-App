param([switch]$IncludeAndroid, [switch]$IncludeIpaAdapter)
$ErrorActionPreference = 'Stop'
$elaRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $elaRoot
$elaReportDir = Join-Path $elaRoot ('.artifacts\week5-run-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $elaReportDir | Out-Null
$elaResults = New-Object System.Collections.Generic.List[object]
function Invoke-ElaCheck([string]$Name, [scriptblock]$Command) {
    Write-Host "Running $Name"
    $global:LASTEXITCODE = 0
    try {
        & $Command
        $elaCode = $LASTEXITCODE
        $elaResults.Add([pscustomobject]@{check=$Name; status=$(if($elaCode -eq 0){'PASS'}else{'FAIL'}); exitCode=$elaCode})
    } catch {
        $elaResults.Add([pscustomobject]@{check=$Name; status='BLOCKED'; exitCode=$null})
        Write-Warning "$Name could not complete. Check local tool/service availability."
    }
}
Invoke-ElaCheck 'TypeScript' { & npx.cmd tsc --noEmit }
Invoke-ElaCheck 'ESLint' { & npm.cmd run lint }
Invoke-ElaCheck 'Home greeting boundaries' { & node --experimental-strip-types --test scripts/test-home-greeting.mjs }
Invoke-ElaCheck 'IPA catalogue and input tests' { & node --experimental-strip-types --test scripts/test-ipa.mjs }
Invoke-ElaCheck 'Expo web export' { & npx.cmd expo export --platform web --output-dir (Join-Path $elaReportDir 'web-export') }
Push-Location (Join-Path $elaRoot 'backend')
try { Invoke-ElaCheck 'Maven (read skipped count in output)' { & mvn.cmd test } } finally { Pop-Location }
if ($IncludeIpaAdapter) {
    $elaPython = Join-Path $elaRoot '.artifacts\openpronounce-venv\Scripts\python.exe'
    if (Test-Path $elaPython) { Invoke-ElaCheck 'IPA adapter unit tests' { & $elaPython scripts/ipa/test_openpronounce_service.py } }
    else { $elaResults.Add([pscustomobject]@{check='IPA adapter unit tests';status='BLOCKED';exitCode=$null}) }
}
if ($IncludeAndroid) {
    Invoke-ElaCheck 'Android smoke' { & python docs/week5-testing/scripts/android-smoke.py }
    Invoke-ElaCheck 'Android extended' { & python docs/week5-testing/scripts/android-smoke.py --extended }
    Invoke-ElaCheck 'Android Home sizes' { & python docs/week5-testing/scripts/android-smoke.py --home-only }
}
$elaResults | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $elaReportDir 'checks.json')
$elaResults | Format-Table -AutoSize
Write-Host 'Command success is not a claim that skipped/partial tests passed. Read individual test reports.'
Write-Host 'iPhone, Gmail OTP, correct audio listening and manual flows require the manual checklist.'
Write-Host "Summary: $elaReportDir\checks.json"
if ($elaResults | Where-Object {$_.status -in 'FAIL','BLOCKED'}) { exit 1 }
