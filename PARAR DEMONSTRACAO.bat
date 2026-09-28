@echo off
powershell.exe -NoProfile -Command "$p=Join-Path '%~dp0' '.local-demo'; if(Test-Path -LiteralPath (Join-Path $p 'running.json')) { Set-Content -LiteralPath (Join-Path $p 'stop.request') -Value 'stop'; Write-Host 'Encerramento solicitado. Aguarde o backup antes de desligar o computador.' } else { Write-Host 'Demonstracao nao esta em execucao.' }"
