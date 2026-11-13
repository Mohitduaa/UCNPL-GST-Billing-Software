@echo off
cd /d "%~dp0_system"
powershell -ExecutionPolicy Bypass -File "start-windows.ps1"
