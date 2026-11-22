@echo off
setlocal
echo Uninstalling Neuron Mind Desktop App...
set "INSTALL_DIR=%LocalAppData%\NeuronMind"
set "DESKTOP_LNK=%UserProfile%\Desktop\Neuron Mind.lnk"
set "START_LNK=%AppData%\Microsoft\Windows\Start Menu\Programs\Neuron Mind.lnk"

if exist "%DESKTOP_LNK%" del /f /q "%DESKTOP_LNK%"
if exist "%START_LNK%" del /f /q "%START_LNK%"
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\NeuronMind" /f >nul 2>&1
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"

echo Neuron Mind has been uninstalled cleanly.
pause
