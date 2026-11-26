param([string]$DbUser, [string]$Database = 'english_learning_db')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\backend')
if (-not $DbUser) { $DbUser = Read-Host 'PostgreSQL username (usually postgres)' }
$env:DB_USERNAME = $DbUser
$elaDbInput = Read-Host 'PostgreSQL password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $elaDbInput).Password
if ([string]::IsNullOrWhiteSpace($env:AUTH_JWT_SECRET)) {
    $elaKey = New-Object byte[] 32
    $elaRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $elaRng.GetBytes($elaKey); $env:AUTH_JWT_SECRET = [Convert]::ToBase64String($elaKey) }
    finally { $elaRng.Dispose(); [Array]::Clear($elaKey, 0, $elaKey.Length) }
    Write-Host 'Created a local JWT key for this PowerShell session. Sign in again in Expo.'
}
$env:MAIL_USERNAME = Read-Host 'Gmail sender with Google App Password enabled'
$elaMailInput = Read-Host 'Google App Password (hidden)' -AsSecureString
$env:MAIL_APP_PASSWORD = ([System.Net.NetworkCredential]::new('', $elaMailInput).Password) -replace '\s', ''
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:5432/$Database"
$env:SERVER_ADDRESS = '0.0.0.0'
$env:SERVER_PORT = '8080'
$env:SPRING_PROFILES_ACTIVE = 'default'
Write-Host 'Starting Backend + Gmail OTP on port 8080. Google sign-in is still a demo.'
& mvn.cmd spring-boot:run
exit $LASTEXITCODE
