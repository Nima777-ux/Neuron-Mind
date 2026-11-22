@echo off
setlocal
cd /d "%~dp0"
echo Launching Neuron Mind Windows Desktop Installer...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-windows-desktop-app.ps1"
if errorlevel 1 (
  echo.
  echo Installation encountered an issue. Press any key to close...
  pause >nul
)
