param([Parameter(Mandatory=$true)][string]$Resources, [Parameter(Mandatory=$true)][string]$Report)
$ErrorActionPreference = 'Stop'
$savedPath = $env:PATH
$results = [ordered]@{ timestamp = (Get-Date).ToUniversalTime().ToString('o'); passed = $false; checks = @{} }
try {
  $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
  $cases = @(
    @{name='Node'; exe='tools/node/node.exe'; args=@('--version'); expected='v24.22.0'},
    @{name='npm'; exe='tools/node/node.exe'; args=@((Join-Path $Resources 'tools/node/node_modules/npm/bin/npm-cli.js'),'--version'); expected='11.19.1'},
    @{name='Python'; exe='tools/python/python.exe'; args=@('--version'); expected='Python 3.13.16'},
    @{name='PythonLibraries'; exe='tools/python/python.exe'; args=@('-c','import ssl, sqlite3, venv, ensurepip; print("SSL SQLite venv ensurepip OK")'); expected='SSL SQLite venv ensurepip OK'},
    @{name='pip'; exe='tools/python/python.exe'; args=@('-m','pip','--version'); expected='pip 26.2.1'},
    @{name='Git'; exe='tools/git/cmd/git.exe'; args=@('--version'); expected='git version 2.56.0.windows.2'},
    @{name='OpenCode'; exe='opencode-cli/opencode.exe'; args=@('--version'); expected='2.0.32'},
    @{name='Ripgrep'; exe='ripgrep/rg.exe'; args=@('--version'); expected='ripgrep'}
  )
  foreach ($case in $cases) {
    $exe = Join-Path $Resources $case.exe
    $arguments = $case.args
    $output = (& $exe @arguments 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $output.Contains($case.expected)) { throw "$($case.name) falhou: $output" }
    $results.checks[$case.name] = $output
  }
  $results.passed = $true
} catch { $results.error = $_.Exception.Message; throw }
finally {
  $env:PATH = $savedPath
  $results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Report -Encoding utf8
}
Write-Output 'Todas as ferramentas incluídas funcionaram sem o PATH de desenvolvimento.'
