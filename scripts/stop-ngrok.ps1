$ErrorActionPreference = "Stop"

$processes = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

if (!$processes) {
    Write-Host "No ngrok process is running."
    exit 0
}

$processes | Stop-Process -Force
Write-Host "ngrok stopped."
