param(
  [string]$AppUrl = "https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app",
  [string]$InstallDir = (Join-Path $env:LocalAppData "NeuronMind")
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $PSScriptRoot

function Find-DesktopAppBrowser {
  $pf = ${env:ProgramFiles}
  $pf86 = ${env:ProgramFiles(x86)}
  $la = ${env:LocalAppData}

  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($base in @($pf86, $pf, $la)) {
    if ([string]::IsNullOrWhiteSpace($base)) { continue }
    $candidates.Add((Join-Path $base "Microsoft\Edge\Application\msedge.exe"))
    $candidates.Add((Join-Path $base "Google\Chrome\Application\chrome.exe"))
    $candidates.Add((Join-Path $base "BraveSoftware\Brave-Browser\Application\brave.exe"))
    $candidates.Add((Join-Path $base "Vivaldi\Application\vivaldi.exe"))
    $candidates.Add((Join-Path $base "Chromium\Application\chrome.exe"))
  }

  foreach ($p in $candidates) {
    if ($p -and (Test-Path $p)) { return $p }
  }

  foreach ($regBase in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"
  )) {
    foreach ($exeName in @("msedge.exe", "chrome.exe", "brave.exe", "vivaldi.exe")) {
      $keyPath = Join-Path $regBase $exeName
      if (Test-Path $keyPath) {
        $val = (Get-ItemProperty -Path $keyPath -ErrorAction SilentlyContinue).'(default)'
        if ($val -and (Test-Path $val)) { return $val }
      }
    }
  }

  foreach ($cmdName in @("msedge.exe", "chrome.exe", "brave.exe")) {
    $cmd = Get-Command $cmdName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) { return $cmd.Source }
  }

  return $null
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Neuron Mind - Windows 10/11 Desktop App Installer  " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$browserExe = Find-DesktopAppBrowser
if ($browserExe) {
  Write-Host "Detected app runtime: $browserExe" -ForegroundColor Gray
} else {
  Write-Host "Note: Edge/Chrome not detected in standard paths; shortcuts will use your default Windows browser." -ForegroundColor Yellow
}

# Copy bundled offline application + launcher + icon into %LocalAppData%\NeuronMind
$DestAppDir = Join-Path $InstallDir "app"
$DestScriptsDir = Join-Path $InstallDir "scripts"
New-Item -ItemType Directory -Force -Path $InstallDir, $DestAppDir, $DestScriptsDir | Out-Null

if (Test-Path (Join-Path $SourceRoot "app")) {
  Write-Host "[1/4] Installing offline application bundle to $DestAppDir ..."
  Copy-Item -Path (Join-Path $SourceRoot "app\*") -Destination $DestAppDir -Recurse -Force
}

$IconSource = Join-Path $SourceRoot "neuron-mind.ico"
$IconDest = Join-Path $InstallDir "neuron-mind.ico"
if (Test-Path $IconSource) {
  Copy-Item -Path $IconSource -Destination $IconDest -Force
}

Copy-Item -Path (Join-Path $PSScriptRoot "launch-neuron-mind.ps1") -Destination (Join-Path $DestScriptsDir "launch-neuron-mind.ps1") -Force
if (Test-Path (Join-Path $SourceRoot "Uninstall-Neuron-Mind.cmd")) {
  Copy-Item -Path (Join-Path $SourceRoot "Uninstall-Neuron-Mind.cmd") -Destination (Join-Path $InstallDir "Uninstall-Neuron-Mind.cmd") -Force
}

$RunCmdPath = Join-Path $InstallDir "NeuronMind.cmd"
@"
@echo off
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\launch-neuron-mind.ps1" -AppUrl "$AppUrl" -AppDir "%~dp0app"
"@ | Set-Content -Path $RunCmdPath -Encoding ASCII

$RunVbsPath = Join-Path $InstallDir "NeuronMind.vbs"
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\scripts\launch-neuron-mind.ps1"" -AppUrl ""$AppUrl"" -AppDir """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\app""", 0, False
"@ | Set-Content -Path $RunVbsPath -Encoding ASCII

Write-Host "[2/4] Creating Desktop and Start Menu shortcuts ..."
$desktopPath = [Environment]::GetFolderPath("Desktop")
$startMenuPath = Join-Path $env:AppData "Microsoft\Windows\Start Menu\Programs"
$shell = New-Object -ComObject WScript.Shell

foreach ($dir in @($desktopPath, $startMenuPath)) {
  $lnkPath = Join-Path $dir "Neuron Mind.lnk"
  $shortcut = $shell.CreateShortcut($lnkPath)
  $shortcut.TargetPath = "wscript.exe"
  $shortcut.Arguments = "`"$RunVbsPath`""
  $shortcut.WorkingDirectory = $InstallDir
  $shortcut.Description = "Neuron Mind - Bilingual Personal AI Assistant (Online & Offline)"
  if (Test-Path $IconDest) {
    $shortcut.IconLocation = "$IconDest,0"
  }
  $shortcut.Save()
}

Write-Host "[3/4] Registering Neuron Mind in Windows Apps & Features ..."
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\NeuronMind"
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name "DisplayName" -Value "Neuron Mind"
Set-ItemProperty -Path $regPath -Name "Publisher" -Value "Neuron Mind"
Set-ItemProperty -Path $regPath -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regPath -Name "InstallLocation" -Value $InstallDir
Set-ItemProperty -Path $regPath -Name "UninstallString" -Value "`"$(Join-Path $InstallDir 'Uninstall-Neuron-Mind.cmd')`""
Set-ItemProperty -Path $regPath -Name "NoModify" -Type DWord -Value 1
Set-ItemProperty -Path $regPath -Name "NoRepair" -Type DWord -Value 1
if (Test-Path $IconDest) {
  Set-ItemProperty -Path $regPath -Name "DisplayIcon" -Value $IconDest
}

Write-Host "[4/4] Launching Neuron Mind Desktop App ..." -ForegroundColor Green
Start-Process "wscript.exe" -ArgumentList "`"$RunVbsPath`""
Write-Host ""
Write-Host "Installation complete! Neuron Mind is installed on your Desktop and Start Menu." -ForegroundColor Green
