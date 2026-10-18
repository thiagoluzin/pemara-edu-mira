@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-demo.ps1" -Professor
if errorlevel 1 pause
