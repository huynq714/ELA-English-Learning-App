param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [int]$DatabasePort = 55436,
    [int]$ApiPort = 58125
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$isolated = Join-Path $root ('.artifacts\week4-auth-' + [Guid]::NewGuid().ToString('N'))
$envNames = @('PGPASSWORD','PGCLIENTENCODING','DB_USERNAME','DB_PASSWORD','SPRING_DATASOURCE_URL',
              'AUTH_JWT_SECRET','AUTH_TOKEN_TTL','AUTH_SMOKE_PORT')
$previous = @{}
foreach ($key in $envNames) { $previous[$key] = [Environment]::GetEnvironmentVariable($key) }
$api = $null
$started = $false
Push-Location $root
try {
    $listeners = netstat -ano -p TCP | Select-String -Pattern ":(${DatabasePort}|${ApiPort})\s+\S+\s+LISTENING"
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
    & "$PostgresBin\psql.exe" @client -f database/week3/schema.sql -f database/week4/migrations/V1_2__source_vocabulary_fields.sql -f database/week4/import/data/apply_a1_import.sql
    if ($LASTEXITCODE) { throw 'Isolated PostgreSQL setup failed' }

    $bytes = [byte[]]::new(32)
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    $env:AUTH_JWT_SECRET = [Convert]::ToBase64String($bytes)
    $env:AUTH_TOKEN_TTL = 'PT1H'
    $env:AUTH_SMOKE_PORT = [string]$ApiPort
    $env:DB_USERNAME = 'auth_check'
    $env:DB_PASSWORD = $password
    $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:$DatabasePort/postgres"
    $appLog = Join-Path $isolated 'spring.log'
    $javaArgs = @('-cp', ('"' + $classpath + '"'), 'com.englishlearning.EnglishLearningApplication',
        '--server.address=127.0.0.1', "--server.port=$ApiPort", '--spring.profiles.active=default')
    $api = Start-Process -FilePath (Join-Path $javaHome 'bin\java.exe') -ArgumentList $javaArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $appLog -RedirectStandardError (Join-Path $isolated 'spring-error.log')
    $ready = $false
    for ($i = 0; $i -lt 65; $i++) {
        if ($api.HasExited) { break }
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
        Start-Sleep -Milliseconds 650
    }
    if (-not $ready) { throw "The isolated Backend did not start. See $appLog" }
    python backend/scripts/test_auth_profile.py
    if ($LASTEXITCODE) { throw "Auth HTTP checks failed. See $appLog" }
    $sql = 'SELECT (SELECT count(*) FROM users WHERE password_hash LIKE ''$2a$%''), (SELECT count(*) FROM user_profiles), (SELECT count(*) FROM user_profiles p JOIN users u ON u.id = p.user_id WHERE p.english_level = ''B1'' AND p.daily_goal_minutes = 30 AND u.display_name = ''Auth Smoke Renamed'' AND p.avatar_url LIKE ''data:image/jpeg;base64,%''), (SELECT count(*) FROM words), (SELECT count(*) FROM deck_words);'
    $actual = & "$PostgresBin\psql.exe" @client -Atc $sql
    if ($LASTEXITCODE -ne 0 -or $actual -ne '3|3|1|43|43') { throw "Unexpected database verification result: $actual" }
    "PASS PostgreSQL persisted BCrypt users|profiles|updated profile with name and avatar|words|links: $actual"
} finally {
    if ($api -and -not $api.HasExited) { Stop-Process -InputObject $api -ErrorAction SilentlyContinue }
    if ($passwordFile -and (Test-Path -LiteralPath $passwordFile)) { Remove-Item -LiteralPath $passwordFile }
    if ($started) { & "$PostgresBin\pg_ctl.exe" -D $data -w stop -m fast }
    foreach ($key in $envNames) { [Environment]::SetEnvironmentVariable($key, $previous[$key]) }
    Pop-Location
}
