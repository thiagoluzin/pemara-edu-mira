$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$stage = Join-Path $repo 'build/openchamber/2.4.0-pemara.1'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$manifest = Get-Content (Join-Path $repo 'installer/opencode/desktop-packages.json') -Raw | ConvertFrom-Json
$receipts = @()
foreach ($item in ($manifest.Packages | Where-Object { $_.Arch -eq 'x64' -and $_.Id -in @('node','python','git') })) {
  $archive = Join-Path $repo ('build/opencode/cache/' + $item.File)
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.Sha256) { throw "Checksum inválido: $($item.File)" }
  $dest = Join-Path $stage ('tools/' + $item.Id)
  if (-not (Test-Path -LiteralPath $dest)) {
    $temp = Join-Path $stage ('extract-' + $item.Id)
    if (Test-Path -LiteralPath $temp) { throw "Extração incompleta: $temp" }
    Expand-Archive -LiteralPath $archive -DestinationPath $temp
    $entries = @(Get-ChildItem -LiteralPath $temp)
    $actual = $temp
    if ($entries.Count -eq 1 -and $entries[0].PSIsContainer) { $actual = $entries[0].FullName }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Get-ChildItem -LiteralPath $actual | Copy-Item -Destination $dest -Recurse
  }
  $receipts += $item
}
$extras = Join-Path $stage 'pemara'
New-Item -ItemType Directory -Path (Join-Path $extras 'exemplo') -Force | Out-Null
foreach ($file in @('aula.html','plano-professor.md','atividade-aluno.html')) {
  Copy-Item -LiteralPath (Join-Path (Join-Path $PSScriptRoot 'assets/exemplo') $file) -Destination (Join-Path $extras 'exemplo')
}
foreach ($variant in @('dark','light')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "assets/pemara-$variant.json") -Destination $extras
}
$rgSource = Join-Path $repo 'pilotos/openchamber/source/node_modules/.bun/@vscode+ripgrep-win32-x64@1.18.0/node_modules/@vscode/ripgrep-win32-x64'
New-Item -ItemType Directory -Path (Join-Path $stage 'ripgrep') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $rgSource 'bin/rg.exe') -Destination (Join-Path $stage 'ripgrep/rg.exe')
Copy-Item -LiteralPath (Join-Path $rgSource 'LICENSE') -Destination (Join-Path $stage 'ripgrep/LICENSE')
Copy-Item -LiteralPath (Join-Path $repo 'pilotos/openchamber/source/LICENSE') -Destination (Join-Path $extras 'LICENSE-OpenChamber.txt')
foreach ($file in @('LICENSE-OpenCode.txt','LEIA-ME-PROFESSORES.txt')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $extras
}
$receipts | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $stage 'dependency-receipts.json') -Encoding utf8
Write-Output "Recursos preparados: $stage"
