param(
  [Parameter(Mandatory = $false)]
  [string]$ApiBaseUrl = "https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app"
)

$ErrorActionPreference = "Stop"
Write-Host "=== Building Neuron Mind Windows Native Installer (.msi / .exe) ===" -ForegroundColor Cyan

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Error "Rust/Cargo not found. Install from https://rustup.rs and restart PowerShell."
}

$env:VITE_API_BASE_URL = $ApiBaseUrl
npm install
npm install -D @tauri-apps/cli
npx tauri icon public/pwa-512x512.png
npx tauri build

Write-Host ""
Write-Host "Build complete! Installers generated inside: src-tauri\target\release\bundle\" -ForegroundColor Green
