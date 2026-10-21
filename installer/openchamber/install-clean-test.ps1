param([switch]$Update)
$ErrorActionPreference='Stop'
$repo=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$release=(node --input-type=module -e "import {version} from './installer/openchamber/release.mjs'; console.log(version)")
if($LASTEXITCODE -ne 0 -or $release -notmatch '^2\.4\.0-pemara\.\d+$'){throw 'Versão de distribuição inválida'}
$stage=Join-Path $repo "build/openchamber/$release"
$setup=Join-Path $repo "ENTREGAS/PEMARA-EDU-$release-Limpo/PEMARA-EDU-$release-Limpo-Windows-x64-Instalar.exe"
$program=Join-Path $env:LOCALAPPDATA 'Programs/PEMARA EDU Teste Limpo'
$profile=Join-Path $env:LOCALAPPDATA 'PEMARAEduTesteLimpo'
$documents=Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PEMARA Aulas - Teste Limpo'
foreach($target in @($profile,$documents)) {if(Test-Path -LiteralPath $target){throw "O teste exige perfil novo: $target"}}
if(-not $Update -and (Test-Path -LiteralPath $program)){throw "A instalação já existe; use -Update para testar atualização: $program"}
if(-not(Test-Path -LiteralPath $setup)){throw 'Instalador final ausente'}
$shortcuts=@((Join-Path ([Environment]::GetFolderPath('Desktop')) 'PEMARA EDU.lnk'),(Join-Path ([Environment]::GetFolderPath('Programs')) 'PEMARA EDU.lnk'))
$before=@{}
foreach($shortcut in $shortcuts){if(Test-Path -LiteralPath $shortcut){$before[$shortcut]=(Get-FileHash -LiteralPath $shortcut).Hash}}
$started=Get-Date
# /D must be last and unquoted according to NSIS's command-line contract.
$process=Start-Process -FilePath $setup -ArgumentList "/S /D=$program" -WindowStyle Hidden -PassThru -Wait
if($process.ExitCode -ne 0){throw "Instalação retornou $($process.ExitCode)"}
if(-not(Test-Path -LiteralPath (Join-Path $program 'PEMARA EDU Teste Limpo.exe'))){throw 'Executável instalado ausente'}
foreach($shortcut in $before.Keys){if((Get-FileHash -LiteralPath $shortcut).Hash -ne $before[$shortcut]){throw 'Atalho anterior foi modificado'}}
$shell=New-Object -ComObject WScript.Shell
$created=@()
foreach($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){
 $link=Join-Path $folder 'PEMARA EDU Teste Limpo.lnk'
 if(-not(Test-Path -LiteralPath $link)){throw "Atalho novo ausente: $link"}
 $actual=$shell.CreateShortcut($link).TargetPath
 if($actual -ne (Join-Path $program 'PEMARA EDU Teste Limpo.exe')){throw 'Atalho novo aponta para outra instalação'}
 $created+=@{path=$link;target=$actual}
}
$report=@{passed=$true;exitCode=$process.ExitCode;startedAt=$started.ToString('o');finishedAt=(Get-Date).ToString('o');installer=$setup;installerSHA256=(Get-FileHash -LiteralPath $setup).Hash;program=$program;previousShortcutsPreserved=$before.Count;newShortcuts=$created;silentInstall=$true;firstLaunchTest='pending'}
$report|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $stage 'evidencias/installation.json') -Encoding utf8
$report|ConvertTo-Json -Depth 5
