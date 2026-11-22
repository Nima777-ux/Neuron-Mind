@echo off
setlocal
cd /d "%~dp0"
echo Starting Neuron Mind in Offline Local Desktop Mode...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-neuron-mind.ps1" -AppDir "%~dp0app" -ForceLocal
