param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [int]$DatabasePort = 55436,
    [int]$ApiPort = 58125,
    [ValidateSet('Auth', 'Quiz', 'PasswordReset', 'MyVocabulary')]
    [string]$Suite = 'Auth',
    [switch]$Web,
    [int]$WebPort = 58126,
    [int]$SmtpPort = 58128
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$isolated = Join-Path $root ('.artifacts\week4-auth-' + [Guid]::NewGuid().ToString('N'))
$envNames = @('PGPASSWORD','PGCLIENTENCODING','DB_USERNAME','DB_PASSWORD','SPRING_DATASOURCE_URL',
              'AUTH_JWT_SECRET','AUTH_TOKEN_TTL','AUTH_SMOKE_PORT','QUIZ_SMOKE_PSQL',
              'QUIZ_SMOKE_DB_PORT','QUIZ_SMOKE_STATE','QUIZ_SMOKE_PASSWORD','QUIZ_WEB_PORT',
              'EXPO_PUBLIC_API_BASE_URL','EXPO_OFFLINE','CI','MAIL_USERNAME','MAIL_APP_PASSWORD',
              'RESET_SMOKE_SMTP_PORT','RESET_SMOKE_PSQL','RESET_SMOKE_DB_PORT')
$previous = @{}
foreach ($key in $envNames) { $previous[$key] = [Environment]::GetEnvironmentVariable($key) }
$api = $null
$metro = $null
$started = $false

function Start-SmokeBackend([string]$label) {
    $appLog = Join-Path $isolated "$label.log"
    $javaArgs = @('-cp', ('"' + $classpath + '"'), 'com.englishlearning.EnglishLearningApplication',
        '--server.address=127.0.0.1', "--server.port=$ApiPort", '--spring.profiles.active=default')
    if ($Suite -eq 'PasswordReset') {
        $javaArgs += @('--spring.mail.host=127.0.0.1', "--spring.mail.port=$SmtpPort",
            '--spring.mail.properties[mail.smtp.auth]=false',
            '--spring.mail.properties[mail.smtp.starttls.enable]=false',
            '--spring.mail.properties[mail.smtp.starttls.required]=false')
    }
    $script:api = Start-Process -FilePath (Join-Path $javaHome 'bin\java.exe') -ArgumentList $javaArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $appLog -RedirectStandardError (Join-Path $isolated "$label-error.log")
    for ($i = 0; $i -lt 65; $i++) {
        if ($script:api.HasExited) { break }
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 2
            if ($r.StatusCode -eq 200) { return }
        } catch {}
        Start-Sleep -Milliseconds 650
    }
    throw "The isolated Backend did not start. See $appLog"
}

Push-Location $root
try {
    $listeners = netstat -ano -p TCP | Select-String -Pattern ":(${DatabasePort}|${ApiPort}|${WebPort}|${SmtpPort})\s+\S+\s+LISTENING"
    if ($listeners) { throw 'Use unused test ports for PostgreSQL and the API' }
    $report = Get-ChildItem backend/target/surefire-reports -Filter 'TEST-*.xml' | Select-Object -First 1
    [xml]$reportXml = Get-Content -LiteralPath $report.FullName -Raw
    $classpath = ($reportXml.testsuite.properties.property | Where-Object name -eq 'java.class.path').value
    $javaHome = ($reportXml.testsuite.properties.property | Where-Object name -eq 'java.home').value
    if (-not $classpath -or -not $javaHome) { throw 'Run mvn -f backend/pom.xml test first to build the API' }

    New-Item -ItemType Directory -Path $isolated | Out-Null
    $data = Join-Path $isolated 'db'
    $passwordFile = Join-Path $isolated 'init-password'
    $password = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    [IO.File]::WriteAllText($passwordFile, $password)
    & "$PostgresBin\initdb.exe" -D $data -U auth_check -A scram-sha-256 --encoding=UTF8 --locale=C --no-sync "--pwfile=$passwordFile" | Out-Null
    if ($LASTEXITCODE) { throw 'initdb failed' }
    Remove-Item -LiteralPath $passwordFile
    & "$PostgresBin\pg_ctl.exe" -D $data -l (Join-Path $isolated 'postgres.log') -o "-p $DatabasePort -h 127.0.0.1" -w start
    if ($LASTEXITCODE) { throw 'Isolated PostgreSQL did not start' }
    $started = $true
    $env:PGPASSWORD = $password
    $env:PGCLIENTENCODING = 'UTF8'
    $client = @('-X','-w','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',$DatabasePort,'-U','auth_check','-d','postgres')
    & "$PostgresBin\psql.exe" @client -f database/week3/schema.sql `
        -f database/week4/migrations/V1_2__source_vocabulary_fields.sql `
        -f database/week4/migrations/V1_3__quiz_question_snapshot.sql `
        -f database/week4/import/data/apply_a1_import.sql `
        -f database/week4/migrations/V1_4__topic_deck_catalog.sql `
        -f database/week4/import/data/apply_topic_decks.sql `
        -f database/week4/migrations/V1_5__password_reset.sql `
        -f database/week5/migrations/V1_6__user_saved_words.sql `
        -f database/week5/migrations/V1_7__fsrs_persistence.sql
    if ($LASTEXITCODE) { throw 'Isolated PostgreSQL setup failed' }

    $snapshotSql = 'SELECT md5(string_agg(to_jsonb(w)::text, '''' ORDER BY w.id)) FROM words w;'
    $exampleSql = @'
SELECT d.topic_key || '|' || count(*) || '|' || count(*) FILTER (
    WHERE NULLIF(btrim(w.example_en), '') IS NOT NULL AND NULLIF(btrim(w.example_vi), '') IS NOT NULL
)
FROM decks d JOIN deck_words dw ON dw.deck_id = d.id JOIN words w ON w.id = dw.word_id
WHERE d.topic_key IS NOT NULL
GROUP BY d.topic_key ORDER BY d.topic_key;
'@
    & "$PostgresBin\psql.exe" @client -f database/week4/import/data/apply_topic_examples.sql
    if ($LASTEXITCODE) { throw 'Topic example enrichment failed' }
    $exampleSnapshot = & "$PostgresBin\psql.exe" @client -Atc $snapshotSql
    & "$PostgresBin\psql.exe" @client -f database/week4/import/data/apply_topic_examples.sql
    if ($LASTEXITCODE -or $exampleSnapshot -ne (& "$PostgresBin\psql.exe" @client -Atc $snapshotSql)) {
        throw 'Topic examples changed when reapplied'
    }
    $examples = @(& "$PostgresBin\psql.exe" @client -Atc $exampleSql)
    if ($LASTEXITCODE -or $examples.Count -ne 6 -or ($examples -notmatch '^[^|]+\|15\|15$')) {
        throw "Unexpected bilingual examples coverage: $examples"
    }
    "PASS six decks have bilingual examples on all 90 cards, and reapplying is safe"

    & "$PostgresBin\psql.exe" @client -f database/week4/import/data/apply_pronunciations.sql
    if ($LASTEXITCODE) { throw 'Pronunciation enrichment failed' }
    $audioSnapshot = & "$PostgresBin\psql.exe" @client -Atc $snapshotSql
    & "$PostgresBin\psql.exe" @client -f database/week4/import/data/apply_pronunciations.sql
    if ($LASTEXITCODE) { throw 'Reapplying pronunciation enrichment failed' }
    if ($audioSnapshot -ne (& "$PostgresBin\psql.exe" @client -Atc $snapshotSql)) {
        throw 'Reapplying pronunciation enrichment changed word data'
    }
    $countsSql = @'
WITH scope AS (
    SELECT 'all' AS catalogue, id, audio_url FROM words
    UNION ALL
    SELECT DISTINCT 'topics', w.id, w.audio_url
    FROM words w JOIN deck_words dw ON dw.word_id = w.id JOIN decks d ON dw.deck_id = d.id
    WHERE d.topic_key IS NOT NULL
)
SELECT catalogue, count(audio_url), count(*) - count(audio_url),
       count(*) FILTER (WHERE audio_url IS NOT NULL AND audio_url IS DISTINCT FROM
           (SELECT source_metadata #>> '{pronunciation,audio,audioUrl}' FROM words WHERE id = scope.id))
FROM scope GROUP BY catalogue ORDER BY catalogue;
'@
    $counts = @(& "$PostgresBin\psql.exe" @client -Atc $countsSql)
    if ($LASTEXITCODE -or $counts.Count -ne 2 -or
        $counts[0] -notmatch '^all\|[1-9][0-9]*\|[0-9]+\|0$' -or
        $counts[1] -notmatch '^topics\|[1-9][0-9]*\|[0-9]+\|0$') {
        throw "Unexpected pronunciation coverage: $counts"
    }
    "PASS PostgreSQL pronunciation coverage (scope|with audio|without audio|provenance mismatch): $counts"

    $bytes = [byte[]]::new(32)
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    $env:AUTH_JWT_SECRET = [Convert]::ToBase64String($bytes)
    $env:AUTH_TOKEN_TTL = 'PT1H'
    $env:AUTH_SMOKE_PORT = [string]$ApiPort
    $env:DB_USERNAME = 'auth_check'
    $env:DB_PASSWORD = $password
    $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:$DatabasePort/postgres"
    if ($Suite -eq 'PasswordReset') {
        $env:MAIL_USERNAME = 'ela-recovery@example.test'
        $env:MAIL_APP_PASSWORD = 'local-smtp-test'
        $env:RESET_SMOKE_SMTP_PORT = [string]$SmtpPort
        $env:RESET_SMOKE_DB_PORT = [string]$DatabasePort
        $env:RESET_SMOKE_PSQL = "$PostgresBin\psql.exe"
        Start-SmokeBackend 'spring'
        python backend/scripts/test_password_reset.py
        if ($LASTEXITCODE) { throw "Password reset HTTP/SQL/SMTP checks failed. See $isolated" }
        "Password reset evidence directory: $isolated"
        return
    }
    Start-SmokeBackend 'spring'
    if ($Suite -eq 'Quiz' -or $Suite -eq 'MyVocabulary') {
        $env:QUIZ_SMOKE_PSQL = "$PostgresBin\psql.exe"
        $env:QUIZ_SMOKE_DB_PORT = [string]$DatabasePort
        $env:QUIZ_SMOKE_STATE = Join-Path $isolated 'quiz-state.json'
        $env:QUIZ_SMOKE_PASSWORD = 'Quiz7' + [Guid]::NewGuid().ToString('N')
        if ($Suite -eq 'MyVocabulary') {
            python backend/scripts/test_my_vocabulary.py
            if ($LASTEXITCODE) { throw "My Vocabulary HTTP/SQL checks failed. See $isolated" }
        } else {
            python backend/scripts/test_quiz.py before-restart
            if ($LASTEXITCODE) { throw "Quiz HTTP/SQL checks failed. See $isolated" }
            Stop-Process -InputObject $api
            if (-not $api.WaitForExit(10000)) { throw 'The first isolated Backend process did not exit' }
            Start-SmokeBackend 'spring-restarted'
            python backend/scripts/test_quiz.py after-restart
            if ($LASTEXITCODE) { throw "Restart checks failed. See $isolated" }
        }
        if ($Web) {
            $env:EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:$WebPort"
            $env:EXPO_OFFLINE = '1'
            $env:CI = '1'
            $env:QUIZ_WEB_PORT = "$WebPort"
            $metro = Start-Process -FilePath 'node.exe' -ArgumentList @('node_modules/expo/bin/cli', 'start', '--localhost', '--port', "$WebPort", '--max-workers', '2') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $isolated 'expo.log') -RedirectStandardError (Join-Path $isolated 'expo-error.log')
            $webScenario = if ($Suite -eq 'MyVocabulary') { 'test-my-vocabulary-web.cjs' } else { 'test-quiz-web.cjs' }
            node "backend/scripts/$webScenario"
            if ($LASTEXITCODE) { throw "$Suite web E2E failed. See $isolated" }
        }
        "$Suite evidence directory: $isolated"
        return
    }
    python backend/scripts/test_auth_profile.py
    if ($LASTEXITCODE) { throw "Auth HTTP checks failed. See $isolated" }
    $sql = 'SELECT (SELECT count(*) FROM users WHERE password_hash LIKE ''$2a$%''), (SELECT count(*) FROM user_profiles), (SELECT count(*) FROM user_profiles p JOIN users u ON u.id = p.user_id WHERE p.english_level = ''B1'' AND p.daily_goal_minutes = 30 AND u.display_name = ''Auth Smoke Renamed'' AND p.avatar_url LIKE ''data:image/jpeg;base64,%''), (SELECT count(*) FROM words), (SELECT count(*) FROM deck_words);'
    $actual = & "$PostgresBin\psql.exe" @client -Atc $sql
    if ($LASTEXITCODE -ne 0 -or $actual -ne '3|3|1|115|133') { throw "Unexpected database verification result: $actual" }
    "PASS PostgreSQL persisted BCrypt users|profiles|updated profile with name and avatar|words|links: $actual"
} finally {
    if ($metro -and -not $metro.HasExited) { Stop-Process -InputObject $metro -ErrorAction SilentlyContinue }
    if ($api -and -not $api.HasExited) { Stop-Process -InputObject $api -ErrorAction SilentlyContinue }
    if ($passwordFile -and (Test-Path -LiteralPath $passwordFile)) { Remove-Item -LiteralPath $passwordFile }
    if ($started) { & "$PostgresBin\pg_ctl.exe" -D $data -w stop -m fast }
    foreach ($key in $envNames) { [Environment]::SetEnvironmentVariable($key, $previous[$key]) }
    Pop-Location
}
