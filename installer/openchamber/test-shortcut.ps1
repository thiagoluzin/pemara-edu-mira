param([string]$ReportPath)
$ErrorActionPreference = 'Stop'
$program = Join-Path $env:LOCALAPPDATA 'Programs/PEMARA OpenChamber/PEMARA OpenChamber.exe'
$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'PEMARA OpenChamber.lnk'
$startMenu = Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/PEMARA OpenChamber.lnk'
$shell = New-Object -ComObject WScript.Shell
foreach ($file in @($desktop,$startMenu)) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Atalho ausente: $file" }
  $shortcut = $shell.CreateShortcut($file)
  if ($shortcut.TargetPath -ine $program -or $shortcut.Arguments) { throw "Destino ou argumentos inesperados no atalho: $file" }
}
Start-Process -FilePath $desktop -WindowStyle Hidden
$deadline = (Get-Date).AddSeconds(40)
do {
  Start-Sleep -Milliseconds 500
  $window = Get-Process -Name 'PEMARA OpenChamber' -ErrorAction SilentlyContinue | Where-Object { $_.Path -ieq $program -and $_.MainWindowHandle -ne 0 }
} until ($window -or (Get-Date) -ge $deadline)
if (-not $window) { throw 'A janela não abriu pelo atalho' }
Start-Sleep -Seconds 4
$processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -ieq $program })
$mainAndGpu = @($processes | Where-Object { $_.CommandLine -notmatch '--type=' -or $_.CommandLine -match '--type=gpu-process' })
if (-not $processes.Count -or ($mainAndGpu | Where-Object { $_.CommandLine -match '--(?:remote-debugging|no-sandbox|disable-gpu-sandbox)' })) { throw 'Inicialização com desativação global/GPU do sandbox ou depuração inesperada' }
$window = Get-Process -Name 'PEMARA OpenChamber' | Where-Object { $_.Path -ieq $program -and $_.MainWindowHandle -ne 0 }
if (-not $window) { throw 'A janela fechou após abrir' }
if (Get-NetTCPConnection -LocalPort 9341 -State Listen -ErrorAction SilentlyContinue) { throw 'Porta de depuração permaneceu aberta' }
$report = [ordered]@{ timestamp = (Get-Date).ToUniversalTime().ToString('o'); passed = $true; desktopShortcut = $desktop; startMenuShortcut = $startMenu; target = $program; windowTitle = @($window.MainWindowTitle); normalLaunchWithoutDebuggingOrGlobalGpuSandboxBypass = $true; rendererPolicy = 'Política herdada do OpenChamber: renderer sandbox:false; o instalador não altera essa configuração.' }
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $ReportPath) { $ReportPath = Join-Path $repo 'build/openchamber/2.4.0-pemara.1/evidencias/atalhos.json' }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ReportPath -Encoding utf8
$report | ConvertTo-Json -Depth 5
