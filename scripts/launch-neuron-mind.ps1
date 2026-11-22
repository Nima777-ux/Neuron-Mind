param(
  [string]$AppUrl = "https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app",
  [string]$AppDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "app"),
  [switch]$ForceLocal
)

$ErrorActionPreference = "SilentlyContinue"

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

function Open-NeuronWindow([string]$TargetUrl, [string]$BrowserExe, [string]$ProfileDir) {
  if ($BrowserExe) {
    Start-Process -FilePath $BrowserExe -ArgumentList "--app=$TargetUrl", "--user-data-dir=$ProfileDir"
  } else {
    Start-Process $TargetUrl
  }
}

$browserExe = Find-DesktopAppBrowser
$ProfileDir = Join-Path $env:LocalAppData "NeuronMind\browser-profile"
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

function Test-HostedServerReachable([string]$Url) {
  try {
    $req = [System.Net.HttpWebRequest]::Create("$($Url.TrimEnd('/'))/api/health")
    $req.Method = "GET"
    $req.Timeout = 5000
    $req.AllowAutoRedirect = $false
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $resp.Close()
    return ($code -ge 200 -and $code -lt 500)
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      $_.Exception.Response.Close()
      return ($code -ge 200 -and $code -lt 500)
    }
    return $false
  } catch {
    return $false
  }
}

$useHosted = $false
if (-not $ForceLocal -and $AppUrl) {
  $useHosted = Test-HostedServerReachable -Url $AppUrl
}

if ($useHosted) {
  Open-NeuronWindow -TargetUrl $AppUrl -BrowserExe $browserExe -ProfileDir $ProfileDir
  exit 0
}

# Offline fallback: serve bundled app/ folder on localhost via built-in .NET HttpListener
if (-not (Test-Path (Join-Path $AppDir "index.html"))) {
  Open-NeuronWindow -TargetUrl $AppUrl -BrowserExe $browserExe -ProfileDir $ProfileDir
  exit 0
}

$Port = 41735
$HostName = "localhost"
$Prefix = "http://${HostName}:${Port}/"

$alreadyRunning = $false
try {
  $ping = Invoke-WebRequest -Uri $Prefix -TimeoutSec 1 -UseBasicParsing
  if ($ping.StatusCode -eq 200) { $alreadyRunning = $true }
} catch {
  $alreadyRunning = $false
}

if ($alreadyRunning) {
  Open-NeuronWindow -TargetUrl $Prefix -BrowserExe $browserExe -ProfileDir $ProfileDir
  exit 0
}

$listener = New-Object System.Net.HttpListener
try {
  $listener.Prefixes.Add($Prefix)
  $listener.Start()
} catch {
  $listener = New-Object System.Net.HttpListener
  $Prefix = "http://127.0.0.1:${Port}/"
  $listener.Prefixes.Add($Prefix)
  $listener.Start()
}

Open-NeuronWindow -TargetUrl $Prefix -BrowserExe $browserExe -ProfileDir $ProfileDir

$mimeMap = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".mjs" = "application/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".ico" = "image/x-icon"
  ".woff2" = "font/woff2"
  ".woff" = "font/woff"
}

$idleDeadline = (Get-Date).AddHours(12)
try {
  while ($listener.IsListening -and (Get-Date) -lt $idleDeadline) {
    $context = $listener.GetContext()
    $reqPath = $context.Request.Url.AbsolutePath.TrimStart('/')

    if ($reqPath -like "api/*" -or $reqPath -eq "api") {
      $errJson = '{"error":{"code":"OFFLINE_LOCAL_MODE","message":"Neuron Mind is running offline from the local desktop bundle. Connect to the internet and relaunch to use live server tools."}}'
      $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errJson)
      $context.Response.StatusCode = 503
      $context.Response.ContentType = "application/json; charset=utf-8"
      $context.Response.ContentLength64 = $errBytes.Length
      $context.Response.OutputStream.Write($errBytes, 0, $errBytes.Length)
      $context.Response.OutputStream.Close()
      continue
    }

    if ([string]::IsNullOrWhiteSpace($reqPath)) { $reqPath = "index.html" }

    $safeRel = $reqPath.Replace('/', [IO.Path]::DirectorySeparatorChar)
    $filePath = Join-Path $AppDir $safeRel
    if (-not (Test-Path $filePath -PathType Leaf)) {
      $filePath = Join-Path $AppDir "index.html"
    }

    $ext = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $context.Response.StatusCode = 200
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
