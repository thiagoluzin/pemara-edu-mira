@echo off
cd /d "%~dp0"
echo Preparacao inicial com internet. Requer Node.js 24 instalado.
call npm.cmd ci
if errorlevel 1 goto falha
call npm.cmd run build
if errorlevel 1 goto falha
call npm.cmd run offline:check
if errorlevel 1 goto falha
echo Preparacao concluida. Use INICIAR PEMARA OFFLINE.bat sem internet.
pause
exit /b 0
:falha
echo Preparacao incompleta. Confira o erro acima antes de levar o computador para a escola.
pause
exit /b 1
