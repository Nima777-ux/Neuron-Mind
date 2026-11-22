param(
  [string]$AppUrl = "https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app"
)

$ErrorActionPreference = "Stop"
Write-Host "=== Neuron Mind - Windows 10/11 Offline Desktop App Installer ===" -ForegroundColor Cyan

# Locate Edge, Chrome, Brave, Vivaldi, or Chromium on Windows
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

$browserExe = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $browserExe) {
  foreach ($regBase in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"
  )) {
    foreach ($exeName in @("msedge.exe", "chrome.exe", "brave.exe", "vivaldi.exe")) {
      $keyPath = Join-Path $regBase $exeName
      if (Test-Path $keyPath) {
        $val = (Get-ItemProperty -Path $keyPath -ErrorAction SilentlyContinue).'(default)'
        if ($val -and (Test-Path $val)) { $browserExe = $val; break }
      }
    }
    if ($browserExe) { break }
  }
}

if (-not $browserExe) {
  foreach ($cmdName in @("msedge.exe", "chrome.exe", "brave.exe")) {
    $cmd = Get-Command $cmdName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) { $browserExe = $cmd.Source; break }
  }
}

$desktopPath = [Environment]::GetFolderPath("Desktop")
$startMenuPath = Join-Path $env:AppData "Microsoft\Windows\Start Menu\Programs"
$shell = New-Object -ComObject WScript.Shell

foreach ($targetDir in @($desktopPath, $startMenuPath)) {
  $lnkPath = Join-Path $targetDir "Neuron Mind.lnk"
  $shortcut = $shell.CreateShortcut($lnkPath)
  if ($browserExe) {
    $shortcut.TargetPath = $browserExe
    $shortcut.Arguments = "--app=$AppUrl"
    $shortcut.WorkingDirectory = Split-Path $browserExe
  } else {
    $shortcut.TargetPath = $AppUrl
  }
  $shortcut.Description = "Neuron Mind - Offline-Capable Personal AI Assistant"
  $shortcut.Save()
  Write-Host "Created shortcut: $lnkPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Launching Neuron Mind..." -ForegroundColor Cyan
if ($browserExe) {
  Start-Process -FilePath $browserExe -ArgumentList "--app=$AppUrl"
} else {
  Write-Host "Note: Edge/Chrome not detected in standard paths; opening in your default Windows browser." -ForegroundColor Yellow
  Start-Process $AppUrl
}
