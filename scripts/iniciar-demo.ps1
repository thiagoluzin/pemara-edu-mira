param([switch]$Professor)
$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $demoRoot
$demoData = Join-Path $demoRoot $(if ($Professor) { '.local-teacher' } else { '.local-demo' })
$demoState = Join-Path $demoData 'running.json'

function Test-DemoReady([string]$Url) {
  try {
    $response = Invoke-RestMethod -Uri ($Url + '/ready') -TimeoutSec 3
    return ($response.ready -eq $true -and $response.status -eq 'ready')
  } catch { return $false }
}

function Open-DemoBrowser([string]$Url) {
  Write-Host ('PEMARA pronto. Abrindo no navegador: ' + $Url)
  # URL uses the Windows default browser. Keep the server process hidden.
  Start-Process -FilePath $Url -ErrorAction Stop
}

if (Test-Path -LiteralPath $demoState) {
  $state = Get-Content -LiteralPath $demoState -Raw | ConvertFrom-Json
  if (Test-DemoReady $state.url) {
    Open-DemoBrowser $state.url
    exit 0
  }
}
if (!(Test-Path -LiteralPath (Join-Path $demoRoot 'dist/index.html'))) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar aplicação.' }
}
New-Item -ItemType Directory -Path $demoData -Force | Out-Null
$nodePath = Join-Path $demoRoot 'runtime/node.exe'
if (!(Test-Path -LiteralPath $nodePath)) { $nodePath = (Get-Command node.exe).Source }
$launchArgs = @('--import','tsx','scripts/demo-local.ts')
if ($Professor) { $launchArgs += '--teacher' }
$demoProcess = Start-Process -FilePath $nodePath -ArgumentList $launchArgs -WorkingDirectory $demoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $demoData 'server.log') -RedirectStandardError (Join-Path $demoData 'server-error.log')
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 1
    $demoProcess.Refresh()
    if ($demoProcess.HasExited) { throw ('Inicialização falhou. Veja ' + (Join-Path $demoData 'server-error.log')) }
    if (Test-Path -LiteralPath $demoState) {
        $state = Get-Content -LiteralPath $demoState -Raw | ConvertFrom-Json
    if (Test-DemoReady $state.url) {
      Open-DemoBrowser $state.url
      exit 0
    }
    }
}
throw ('Inicialização ainda não confirmou prontidão. Consulte ' + (Join-Path $demoData 'server.log'))
