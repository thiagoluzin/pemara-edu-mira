$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$stage = Join-Path $repo 'build/openchamber/2.4.0-pemara.1'
$program = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs/PEMARA OpenChamber'))
$profile = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PEMARAOpenChamber/perfil'))
$lessons = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PEMARA Aulas'
$backup = Join-Path $stage ('originais-antes-reinstalar-' + (Get-Date -Format yyyyMMdd-HHmmss))
if (-not (Test-Path -LiteralPath (Join-Path $program 'Uninstall PEMARA OpenChamber.exe'))) { throw 'Desinstalador não encontrado' }
if ($program -eq $profile -or $lessons.StartsWith($program)) { throw 'Pastas de dados precisam ficar fora do programa' }
$ownedProcesses = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -ieq (Join-Path $program 'PEMARA OpenChamber.exe') }
if ($ownedProcesses) { throw 'Feche o aplicativo antes do teste' }
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $profile -Destination (Join-Path $backup 'perfil') -Recurse
Copy-Item -LiteralPath $lessons -Destination (Join-Path $backup 'aulas') -Recurse
$protected = @((Join-Path $profile '.local/share/opencode/opencode.db'), (Join-Path $profile '.config/openchamber/settings.json'))
$protected += @(Get-ChildItem -LiteralPath $lessons -File -Recurse | Select-Object -ExpandProperty FullName)
$hashes = @{}
foreach ($file in $protected) { $hashes[$file] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash }
$uninstaller = Start-Process -FilePath (Join-Path $program 'Uninstall PEMARA OpenChamber.exe') -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
# NSIS may launch a temporary uninstaller and let the original exit first.
$deadline = (Get-Date).AddSeconds(90)
while ((Test-Path -LiteralPath (Join-Path $program 'PEMARA OpenChamber.exe')) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
if (Test-Path -LiteralPath (Join-Path $program 'PEMARA OpenChamber.exe')) { throw 'A desinstalação não terminou' }
foreach ($file in $protected) { if (-not (Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file).Hash -ne $hashes[$file]) { throw "Dado alterado na desinstalação: $file" } }
$setup = Join-Path $stage 'dist-final/PEMARA-OpenChamber-2.4.0-pemara.2-Windows-x64-Instalar.exe'
$installer = Start-Process -FilePath $setup -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
if ($installer.ExitCode -ne 0) { throw "Instalador final retornou $($installer.ExitCode)" }
foreach ($file in $protected) { if ((Get-FileHash -LiteralPath $file).Hash -ne $hashes[$file]) { throw "Dado alterado na reinstalação: $file" } }
$acl = Get-Acl -LiteralPath $program
$sandboxRule = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq 'S-1-15-2-2' -and $_.AccessControlType -eq 'Allow' }
if (-not $sandboxRule) { throw 'Regra de leitura para o sandbox não foi instalada' }
if (-not (Test-Path -LiteralPath (Join-Path $program 'resources/pemara/LICENSE-OpenCode.txt'))) { throw 'Licença do motor ausente' }
$report = [ordered]@{ timestamp = (Get-Date).ToUniversalTime().ToString('o'); passed = $true; uninstallExit = $uninstaller.ExitCode; installExit = $installer.ExitCode; preservedFiles = $protected.Count; backup = $backup; installerSha256 = (Get-FileHash -LiteralPath $setup).Hash; sandboxReadExecuteInstalled = $true; sourceFoldersUntouched = $true }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stage 'evidencias/desinstalacao-reinstalacao.json') -Encoding utf8
$report | ConvertTo-Json -Depth 5
