param(
    [string]$Username = 'postgres',
    [string]$PostgresBin = (Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'),
    [int]$Port = 5432,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$databaseName = 'english_learning_db'
$dbArgs = @('-h', 'localhost', '-p', $Port, '-U', $Username, '-d', $databaseName)
$psql = Join-Path $PostgresBin 'psql.exe'
$pgDump = Join-Path $PostgresBin 'pg_dump.exe'
$pgRestore = Join-Path $PostgresBin 'pg_restore.exe'
$migration = Join-Path $PSScriptRoot '../migrations/V1_4__topic_deck_catalog.sql'
$import = Join-Path $PSScriptRoot 'data/apply_topic_decks.sql'

foreach ($file in @($psql, $pgDump, $pgRestore, $migration, $import)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Required file is missing: $file"
    }
}

$previousPassword = $env:PGPASSWORD
$previousClientEncoding = $env:PGCLIENTENCODING
$previousConsoleEncoding = [Console]::OutputEncoding
$utf8 = [Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
try {
    if (-not $env:PGPASSWORD) {
        $secret = Read-Host 'PostgreSQL password (local input)' -AsSecureString
        $credential = [PSCredential]::new($Username, $secret)
        $env:PGPASSWORD = $credential.GetNetworkCredential().Password
    }
    $env:PGCLIENTENCODING = 'UTF8'
    [Console]::OutputEncoding = $utf8

    $prerequisites = @'
SELECT current_database() = 'english_learning_db'
   AND current_setting('server_encoding') = 'UTF8'
   AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'words'
                 AND column_name = 'meaning_vi' AND is_nullable = 'NO')
   AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'words' AND column_name = 'source_metadata')
   AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'quiz_attempts' AND column_name = 'question_snapshot')
   AND to_regclass('public.deck_words') IS NOT NULL;
'@
    $valid = & $psql @dbArgs -X -w -At -v ON_ERROR_STOP=1 -c $prerequisites
    if ($LASTEXITCODE -ne 0 -or $valid -ne 't') {
        throw 'Check your PostgreSQL connection, Week 3 schema and migrations V1_2 and V1_3.'
    }

    $migrationBody = Get-Content -Raw -Encoding UTF8 -LiteralPath $migration
    $importBody = Get-Content -Raw -Encoding UTF8 -LiteralPath $import
    $migrationBody = $migrationBody -replace '(?s)^BEGIN;\s*', '' -replace 'COMMIT;\s*$', ''
    $importBody = $importBody -replace '(?m)^BEGIN;\s*', '' -replace 'COMMIT;\s*$', ''
    $transaction = "BEGIN;" + [Environment]::NewLine + $migrationBody + [Environment]::NewLine + $importBody

    if ($Apply) {
        $backupDir = Join-Path $PSScriptRoot '../../../.artifacts/week4-topic-backups'
        New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
        $backup = Join-Path $backupDir ("english_learning_db-" + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.backup')
        & $pgDump @dbArgs -w -Fc -f $backup
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backup -PathType Leaf)) {
            throw 'Backup failed. No migration or import was applied.'
        }
        & $pgRestore -l $backup | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'The backup archive could not be read. No migration or import was applied.'
        }
        Write-Output "Backup: $((Get-Item -LiteralPath $backup).FullName)"
    }

    Write-Output 'Dry run'
    ($transaction + [Environment]::NewLine + 'ROLLBACK;') | & $psql @dbArgs -X -w -v ON_ERROR_STOP=1 -f -
    if ($LASTEXITCODE -ne 0) {
        throw 'Dry run failed. No migration or import was applied.'
    }
    if (-not $Apply) { return }

    Write-Output 'Apply topic catalogue'
    ($transaction + [Environment]::NewLine + 'COMMIT;') | & $psql @dbArgs -X -w -v ON_ERROR_STOP=1 -f -
    if ($LASTEXITCODE -ne 0) {
        throw 'Migration or import failed and was rolled back. Check the PostgreSQL output above.'
    }
} finally {
    $env:PGPASSWORD = $previousPassword
    $env:PGCLIENTENCODING = $previousClientEncoding
    [Console]::OutputEncoding = $previousConsoleEncoding
}
