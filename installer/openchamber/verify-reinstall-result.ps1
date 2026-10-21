$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$stage = Join-Path $repo 'build/openchamber/2.4.0-pemara.1'
$backup = Join-Path $stage 'originais-antes-reinstalar-20261018-145758'
$program = Join-Path $env:LOCALAPPDATA 'Programs/PEMARA OpenChamber'
$profile = Join-Path $env:LOCALAPPDATA 'PEMARAOpenChamber/perfil'
$lessons = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PEMARA Aulas'
$pairs = @(
  @{ original = Join-Path $backup 'perfil/.local/share/opencode/opencode.db'; current = Join-Path $profile '.local/share/opencode/opencode.db' },
  @{ original = Join-Path $backup 'perfil/.config/openchamber/settings.json'; current = Join-Path $profile '.config/openchamber/settings.json' }
)
foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $backup 'aulas') -File -Recurse)) {
  $relative = [IO.Path]::GetRelativePath((Join-Path $backup 'aulas'), $file.FullName)
  $pairs += @{ original = $file.FullName; current = Join-Path $lessons $relative }
}
foreach ($pair in $pairs) {
  if ((Get-FileHash -LiteralPath $pair.original).Hash -ne (Get-FileHash -LiteralPath $pair.current).Hash) { throw "Preservação falhou: $($pair.current)" }
}
$rules = (Get-Acl -LiteralPath $program).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
$rule = $rules | Where-Object { $_.IdentityReference.Value -eq 'S-1-15-2-2' -and $_.AccessControlType -eq 'Allow' -and -not $_.IsInherited }
if (-not $rule -or (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::ReadAndExecute) -ne [Security.AccessControl.FileSystemRights]::ReadAndExecute)) { throw 'Permissão de leitura/execução do sandbox ausente' }
if (-not (Test-Path -LiteralPath (Join-Path $program 'resources/pemara/LICENSE-OpenCode.txt'))) { throw 'Licença do motor ausente' }
$setup = Join-Path $stage 'dist-final/PEMARA-OpenChamber-2.4.0-pemara.2-Windows-x64-Instalar.exe'
$report = [ordered]@{
  timestamp = (Get-Date).ToUniversalTime().ToString('o'); passed = $true
  preservedFiles = $pairs.Count; backup = $backup
  installerSha256 = (Get-FileHash -LiteralPath $setup).Hash
  sandboxReadExecuteInstalled = $true; openCodeLicenseInstalled = $true
  note = 'O teste original concluiu desinstalação, instalação (código 0) e comparação dos arquivos, mas parou ao traduzir uma identidade Windows não resolvida. Esta verificação usa SIDs diretamente e compara novamente com o backup anterior, antes de abrir o aplicativo.'
}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stage 'evidencias/desinstalacao-reinstalacao.json') -Encoding utf8
$report | ConvertTo-Json -Depth 5
