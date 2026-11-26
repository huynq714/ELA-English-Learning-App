param([string]$LanIp)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (-not $LanIp) {
    ipconfig
    $LanIp = Read-Host 'Laptop Wi-Fi IPv4 (same network as iPhone)'
}
$elaParsedIp = $null
if (-not [System.Net.IPAddress]::TryParse($LanIp, [ref]$elaParsedIp) -or
    $elaParsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
    $LanIp -like '127.*' -or $LanIp -eq '0.0.0.0' -or $LanIp -eq '10.0.2.2') {
    throw 'Enter the actual Wi-Fi IPv4 of the laptop, not localhost/emulator gateway.'
}
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_AVD_HOME = 'D:\Android\Avd'
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
$env:EXPO_PUBLIC_API_BASE_URL = "http://${LanIp}:8080"
$elaHealth = Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/health' -TimeoutSec 5
Write-Host "Shared API: $env:EXPO_PUBLIC_API_BASE_URL"
Write-Host 'Scan QR on iPhone; press a here to open the running Android emulator.'
& npx.cmd expo start --go --lan --clear
exit $LASTEXITCODE
