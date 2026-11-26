$ErrorActionPreference = 'Stop'
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_AVD_HOME = 'D:\Android\Avd'
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd ELA_Pixel2_API34 -memory 2048 -cores 2 -gpu software -feature -Vulkan -no-snapshot -no-boot-anim
exit $LASTEXITCODE
