param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin',
    [string]$StateDirectory
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if (-not $StateDirectory) { $StateDirectory = Join-Path $root '.artifacts/week5-environment' }
$data = Join-Path $StateDirectory 'pgdata'
$port = 55436
$client = Join-Path $PostgresBin 'psql.exe'
New-Item -ItemType Directory -Force -Path $StateDirectory | Out-Null
$secretPath = Join-Path $StateDirectory 'secrets.clixml'

function New-RandomSecret {
    $bytes = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    [Convert]::ToBase64String($bytes)
}
if (-not (Test-Path -LiteralPath $secretPath)) {
    if (Test-Path -LiteralPath $data) { throw 'Existing cluster without local credentials: inspect manually.' }
    [PSCustomObject]@{
        DbPassword = (ConvertTo-SecureString (New-RandomSecret) -AsPlainText -Force)
        JwtSecret = (ConvertTo-SecureString (New-RandomSecret) -AsPlainText -Force)
    } | Export-Clixml -LiteralPath $secretPath
}
$secrets = Import-Clixml -LiteralPath $secretPath
$previousPassword = $env:PGPASSWORD
$previousEncoding = $env:PGCLIENTENCODING
try {
    $env:PGPASSWORD = [Net.NetworkCredential]::new('', $secrets.DbPassword).Password
    $env:PGCLIENTENCODING = 'UTF8'
    $fresh = -not (Test-Path -LiteralPath $data)
    if ($fresh) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw 'Test port occupied; refusing to connect to an unknown server.'
        }
        $passwordFile = Join-Path $StateDirectory 'init-password.tmp'
        try {
            [IO.File]::WriteAllText($passwordFile, $env:PGPASSWORD)
            & "$PostgresBin/initdb.exe" -D $data -U ela_week5 -A scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordFile"
            if ($LASTEXITCODE) { throw 'initdb failed' }
        } finally {
            if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
        }
    }
    & "$PostgresBin/pg_ctl.exe" -D $data status
    if ($LASTEXITCODE) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw 'Test port occupied by another process.'
        }
        & "$PostgresBin/pg_ctl.exe" -D $data -l (Join-Path $StateDirectory 'postgres.log') -o "-p $port -h 127.0.0.1" -w start
        if ($LASTEXITCODE) { throw 'Test PostgreSQL startup failed' }
    }
    $connection = @('-X','-w','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',"$port",'-U','ela_week5')
    $actualData = & $client @connection -d postgres -Atc 'SHOW data_directory;'
    if ($LASTEXITCODE -or [IO.Path]::GetFullPath($actualData.Trim()) -ne [IO.Path]::GetFullPath($data)) {
        throw 'Unexpected PostgreSQL data directory.'
    }
    $database = 'english_learning_fsrs_test'
    $exists = & $client @connection -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='$database';"
    if ($LASTEXITCODE) { throw 'Cannot inspect test database' }
    if ($exists -ne '1') {
        & $client @connection -d postgres -c "CREATE DATABASE $database ENCODING 'UTF8';"
        if ($LASTEXITCODE) { throw 'Cannot create test database' }
    }
    $tableCount = & $client @connection -d $database -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
    if ($LASTEXITCODE) { throw 'Cannot inspect schema' }
    if ($tableCount -eq '0') {
        $files = @(
            'database/week3/schema.sql',
            'database/week4/migrations/V1_2__source_vocabulary_fields.sql',
            'database/week4/migrations/V1_3__quiz_question_snapshot.sql',
            'database/week4/migrations/V1_4__topic_deck_catalog.sql',
            'database/week4/import/data/apply_topic_decks.sql',
            'database/week4/migrations/V1_5__password_reset.sql',
            'database/week4/import/data/apply_pronunciations.sql',
            'database/week4/import/data/apply_topic_examples.sql',
            'database/week5/migrations/V1_6__user_saved_words.sql',
            'database/week5/migrations/V1_7__fsrs_persistence.sql'
        )
        foreach ($file in $files) {
            Write-Output "APPLY $file"
            & $client @connection -d $database -f (Join-Path $root $file)
            if ($LASTEXITCODE) { throw "Database preparation failed: $file. Inspect partial schema before retry." }
        }
    } else {
        Write-Output 'Existing schema preserved; migrations were not replayed.'
    }
    & $client @connection -d $database -f (Join-Path $PSScriptRoot 'verify-environment.sql')
    if ($LASTEXITCODE) { throw 'Database verification failed' }
} finally {
    $env:PGPASSWORD = $previousPassword
    $env:PGCLIENTENCODING = $previousEncoding
}
