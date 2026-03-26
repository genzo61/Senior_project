param(
    [string]$InstallDir = "tools/ngrok",
    [string]$DownloadUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$targetDir = Join-Path $projectRoot $InstallDir
$exePath = Join-Path $targetDir "ngrok.exe"

if (Test-Path $exePath) {
    Write-Host "ngrok already exists at $exePath"
    exit 0
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$zipPath = Join-Path $targetDir "ngrok.zip"

Write-Host "Downloading ngrok..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath

Write-Host "Extracting ngrok..."
Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force
Remove-Item $zipPath -Force

if (!(Test-Path $exePath)) {
    throw "ngrok.exe was not found after extraction."
}

Write-Host "ngrok installed: $exePath"
