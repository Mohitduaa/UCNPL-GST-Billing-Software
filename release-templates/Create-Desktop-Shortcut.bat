@echo off
title Creating Desktop Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell;$desktop=[Environment]::GetFolderPath('Desktop');$s=$ws.CreateShortcut((Join-Path $desktop 'UCNPL Billing.lnk'));$s.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe';$s.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"""' + '%~dp0_system\start-windows.ps1' + '\""" -AppWindow -Hidden';$s.WorkingDirectory='%~dp0_system';$s.WindowStyle=7;$s.IconLocation='%~dp0app-icon.ico,0';$s.Description='UCNPL GST Billing Software';$s.Save();Remove-Item (Join-Path $desktop 'Start-Windows - Shortcut.lnk') -Force -ErrorAction SilentlyContinue;Write-Host 'Desktop shortcut created with app icon successfully!' -ForegroundColor Green"
echo.
echo ========================================================
echo   UCNPL Billing shortcut created on your Desktop!
echo ========================================================
echo.
timeout /t 3
