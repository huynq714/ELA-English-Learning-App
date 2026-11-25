param([string]$StateDirectory)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if (-not $StateDirectory) {
    $StateDirectory = Join-Path $projectRoot '.artifacts/week5-environment'
}
$secrets = Import-Clixml (Join-Path $StateDirectory 'secrets.clixml')
$java = (Get-Command java -ErrorAction Stop).Source
$jar = Join-Path $projectRoot 'backend/target/english-learning-api-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $jar)) {
    throw 'Build the backend with Maven before starting this script.'
}
$env:DB_USERNAME = 'ela_week5'
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secrets.DbPassword).Password
$env:AUTH_JWT_SECRET = [System.Net.NetworkCredential]::new('', $secrets.JwtSecret).Password
$env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://127.0.0.1:55436/english_learning_fsrs_test'
$env:SERVER_ADDRESS = '127.0.0.1'
$env:SERVER_PORT = '58125'
Set-Location $projectRoot
try {
    & $java -jar $jar
} finally {
    Remove-Item Env:DB_PASSWORD, Env:AUTH_JWT_SECRET -ErrorAction SilentlyContinue
}
