@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\parar-professor.ps1"
if errorlevel 1 pause
