$ErrorActionPreference = 'Stop'
$teacherData = Join-Path (Split-Path -Parent $PSScriptRoot) '.local-teacher'
$statePath = Join-Path $teacherData 'running.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Host 'PEMARA offline nao esta em execucao.'; exit 0 }
Set-Content -LiteralPath (Join-Path $teacherData 'stop.request') -Value 'stop'
Write-Host 'Encerrando e criando backup. Aguarde...'
for ($attempt = 0; $attempt -lt 120; $attempt++) {
  Start-Sleep -Seconds 1
  if (!(Test-Path -LiteralPath $statePath)) {
    $receipt = Get-Content -LiteralPath (Join-Path $teacherData 'last-shutdown.json') -Raw | ConvertFrom-Json
    if (!$receipt.backupSaved -or !(Test-Path -LiteralPath $receipt.backupPath)) {
      throw 'Banco preservado, mas o backup nao foi concluido. Confira server-error.log e o espaco em disco antes de desligar.'
    }
    Write-Host ('Encerrado. Backups em: ' + (Join-Path $teacherData 'backups'))
    exit 0
  }
}
throw ('Encerramento ainda nao confirmado. Consulte ' + (Join-Path $teacherData 'server-error.log'))
