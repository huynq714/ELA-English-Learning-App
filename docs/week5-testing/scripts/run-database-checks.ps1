param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$state = Join-Path $root '.artifacts/week5-environment'
$secret = Import-Clixml (Join-Path $state 'secrets.clixml')
$env:PGPASSWORD = [Net.NetworkCredential]::new('', $secret.DbPassword).Password
$env:PGCLIENTENCODING = 'UTF8'
$psql = Join-Path $PostgresBin 'psql.exe'
$connection = @('-X','-w','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55436','-U','ela_week5')
try {
    $actualData = & $psql @connection -d postgres -Atc 'SHOW data_directory;'
    if ($LASTEXITCODE -or [IO.Path]::GetFullPath($actualData.Trim()) -ne (Join-Path $state 'pgdata')) {
        throw 'Not the known isolated cluster'
    }
    $exists = & $psql @connection -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='english_learning_test';"
    if ($LASTEXITCODE -or $exists -eq '1') { throw 'Refusing to overwrite or rerun against an existing database' }
    & $psql @connection -d postgres -c "CREATE DATABASE english_learning_test ENCODING 'UTF8';"
    if ($LASTEXITCODE) { throw 'Test DB creation failed' }
    $connection += @('-d','english_learning_test')
    foreach ($file in @('schema.sql','test_basic_constraints.sql','test_integrity_workflows.sql')) {
        & $psql @connection -f (Join-Path $root "database/week3/$file")
        if ($LASTEXITCODE) { throw "Unexpected SQL failure: $file" }
        Write-Output "PASS $file"
    }
    foreach ($file in @('test_quiz_missing_answer_commit.sql','test_quiz_score_mismatch_commit.sql',
                        'test_conversation_incomplete_commit.sql')) {
        $negativeLog = Join-Path $state "$file.log"
        # Native stderr contains the expected database rejection.
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $psql @connection -f (Join-Path $root "database/week3/$file") *> $negativeLog
        $negativeCode = $LASTEXITCODE
        $ErrorActionPreference = $oldPreference
        $expected = if ($file -like 'test_quiz*') { 'must have five answers and a matching score' }
                    else { 'five USER messages' }
        $content = [IO.File]::ReadAllText($negativeLog)
        if ($negativeCode -ne 3 -or $content -notmatch [regex]::Escape($expected)) {
            Get-Content -LiteralPath $negativeLog
            throw "Unexpected negative-test result: $file, exit $negativeCode"
        }
        Write-Output "PASS $file (expected COMMIT rejection, psql exit 3)"
    }
    $remaining = & $psql @connection -Atc "SELECT count(*) FROM users WHERE email IN ('quiz-missing-test@example.invalid','quiz-score-test@example.invalid','conversation-test@example.invalid');"
    if ($LASTEXITCODE -or $remaining -ne '0') { throw 'Negative transactions were not rolled back' }
    Write-Output 'PASS negative fixture transactions rolled back completely'
    & $psql @connection -f (Join-Path $root 'database/week3/test_user_cascade.sql')
    if ($LASTEXITCODE) { throw 'Cascade test failed' }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
