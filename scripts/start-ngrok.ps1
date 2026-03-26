param(
    [int]$BackendPort = 8085,
    [int]$CustomerWebPort = 5174,
    [switch]$Foreground
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$setupScript = Join-Path $PSScriptRoot "setup-ngrok.ps1"
$ngrokExe = Join-Path $projectRoot "tools/ngrok/ngrok.exe"
$configPath = Join-Path $projectRoot "tools/ngrok/ngrok.yml"
$logOutPath = Join-Path $projectRoot "tools/ngrok/ngrok.out.log"
$logErrPath = Join-Path $projectRoot "tools/ngrok/ngrok.err.log"

if (!(Test-Path $ngrokExe)) {
    & $setupScript
}

$authToken = $env:NGROK_AUTHTOKEN
if (![string]::IsNullOrWhiteSpace($authToken)) {
    & $ngrokExe config add-authtoken $authToken | Out-Null
} else {
    Write-Warning "NGROK_AUTHTOKEN is not set. If agent start fails, set the token first."
}

$configContent = @"
version: "3"
agent:
  log_level: info
tunnels:
  backend:
    proto: http
    addr: ${BackendPort}
  customer_web:
    proto: http
    addr: ${CustomerWebPort}
"@

Set-Content -Path $configPath -Value $configContent -Encoding ascii

if ($Foreground) {
    & $ngrokExe start --all --config $configPath
    exit $LASTEXITCODE
}

Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force

$proc = Start-Process -FilePath $ngrokExe `
    -ArgumentList @("start", "--all", "--config", $configPath) `
    -RedirectStandardOutput $logOutPath `
    -RedirectStandardError $logErrPath `
    -PassThru

Start-Sleep -Seconds 3
$proc.Refresh()

if ($proc.HasExited) {
    Write-Error "ngrok exited right after startup. Check logs: $logOutPath and $logErrPath"
    if (Test-Path $logOutPath) {
        Get-Content $logOutPath -Tail 20
    }
    if (Test-Path $logErrPath) {
        Get-Content $logErrPath -Tail 20
    }
    exit 1
}

try {
    $api = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
    $backendTunnel = ($api.tunnels | Where-Object { $_.name -eq "backend" } | Select-Object -First 1)
    $webTunnel = ($api.tunnels | Where-Object { $_.name -eq "customer_web" } | Select-Object -First 1)

    if ($null -eq $backendTunnel) {
        $backendTunnel = $api.tunnels | Where-Object { $_.config.addr -like "*:$BackendPort" } | Select-Object -First 1
    }
    if ($null -eq $webTunnel) {
        $webTunnel = $api.tunnels | Where-Object { $_.config.addr -like "*:$CustomerWebPort" } | Select-Object -First 1
    }

    $backendUrl = if ($null -ne $backendTunnel) { $backendTunnel.public_url } else { "" }
    $webUrl = if ($null -ne $webTunnel) { $webTunnel.public_url } else { "" }

    Write-Host "ngrok started (PID: $($proc.Id))"
    Write-Host "Backend public URL: $backendUrl"
    Write-Host "Customer web public URL: $webUrl"
    Write-Host "Inspector: http://127.0.0.1:4040"
    Write-Host "Logs: $logOutPath / $logErrPath"
} catch {
    Write-Warning "ngrok started but tunnel URLs could not be read from local API."
    Write-Host "PID: $($proc.Id)"
    Write-Host "Logs: $logOutPath / $logErrPath"
}
