$ErrorActionPreference='Stop'
$repoRoot=Split-Path (Split-Path $PSScriptRoot)
$testRoot=Join-Path $repoRoot 'build/opencode'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$output=Join-Path $testRoot 'SerializationRegression.exe'
& $compiler /nologo /codepage:65001 /target:exe /main:SerializationRegression /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll "/out:$output" (Join-Path $PSScriptRoot 'Installer.cs') (Join-Path $PSScriptRoot 'SerializationRegression.cs')
if($LASTEXITCODE -ne 0){throw 'Regression test compilation failed'}
& $output $repoRoot | Tee-Object -FilePath (Join-Path $testRoot 'serialization-regression-r4.txt')
if($LASTEXITCODE -ne 0){throw 'Serialization regression failed'}
