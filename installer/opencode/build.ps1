param([switch]$Download)
$ErrorActionPreference='Stop'
$sourceRoot=$PSScriptRoot
$repoRoot=Split-Path (Split-Path $sourceRoot)
$buildRoot=Join-Path $repoRoot 'build/opencode'
$cache=Join-Path $buildRoot 'cache'
$dist=Join-Path $buildRoot 'dist-desktop'
New-Item -ItemType Directory -Force $cache,$dist | Out-Null
$manifest=Get-Content (Join-Path $sourceRoot 'desktop-packages.json') -Raw | ConvertFrom-Json
$packages=@($manifest.Packages)
foreach($package in $packages){
 $path=Join-Path $cache $package.File
 if(!(Test-Path -LiteralPath $path)){
  if(!$Download){throw "Pacote ausente: $path. Use -Download na máquina de preparação."}
  if(!$package.Url){throw "Pacote Desktop adaptado ausente. Execute prepare-desktop.mjs na maquina de preparacao."}
  Invoke-WebRequest -Uri $package.Url -OutFile ($path+'.partial')
  Move-Item -LiteralPath ($path+'.partial') -Destination $path
 }
 if((Get-Item -LiteralPath $path).Length -ne $package.Size -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $package.Sha256){throw "Integridade inválida: $path"}
 Write-Output "Conferido: $($package.File)"
}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$common=@('/nologo','/codepage:65001','/target:winexe','/platform:anycpu','/optimize+','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Web.Extensions.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll','/r:Microsoft.CSharp.dll',('/win32manifest:'+(Join-Path $sourceRoot 'app.manifest')),('/resource:'+(Join-Path $sourceRoot 'desktop-packages.json')+',packages.json'))
$launcher=Join-Path $buildRoot 'OpenCode-Aulas.exe'
& $compiler @common "/out:$launcher" (Join-Path $sourceRoot 'Installer.cs')
if($LASTEXITCODE -ne 0){throw 'Compilação do atalho falhou'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$payload=Join-Path $buildRoot ('payload-'+[Guid]::NewGuid().ToString('N')+'.zip')
$zip=[IO.Compression.ZipFile]::Open($payload,[IO.Compression.ZipArchiveMode]::Create)
try {
 foreach($package in $packages){[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $cache $package.File),$package.File,[IO.Compression.CompressionLevel]::NoCompression) | Out-Null}
 [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$launcher,'OpenCode-Aulas.exe') | Out-Null
 [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $sourceRoot 'LEIA-ME-DESKTOP.html'),'LEIA-ME.html') | Out-Null
 [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $sourceRoot 'OpenCode-LICENSE.txt'),'OpenCode-LICENSE.txt') | Out-Null
} finally {$zip.Dispose()}
$output=Join-Path $dist 'PEMARA-OpenCode-Desktop-Offline-Windows-r4.exe'
if(Test-Path -LiteralPath $output){Copy-Item -LiteralPath $output -Destination ($output+'.previous-'+(Get-Date -Format yyyyMMddHHmmss))}
& $compiler @common "/resource:$payload,payload.zip" "/out:$output" (Join-Path $sourceRoot 'Installer.cs')
if($LASTEXITCODE -ne 0){throw 'Compilação do instalador falhou'}
Copy-Item (Join-Path $sourceRoot 'desktop-packages.json'),(Join-Path $sourceRoot 'LEIA-ME-DESKTOP.html') -Destination $dist -Force
$hash=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $dist 'SHA256SUMS-r4.txt') -Value "$hash  PEMARA-OpenCode-Desktop-Offline-Windows-r4.exe" -Encoding ascii
Write-Output "Pronto: $output ($((Get-Item $output).Length) bytes)"
