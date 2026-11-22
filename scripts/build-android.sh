#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${1:-https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app}"

echo "=== Building Neuron Mind Android Package (.apk / .aab) ==="
export VITE_API_BASE_URL="$API_BASE_URL"

npm install
npm install @capacitor/core @capacitor/app @capacitor/haptics @capacitor/keyboard \
  @capacitor/local-notifications @capacitor/network @capacitor/preferences \
  @capacitor/push-notifications @capacitor/share @capacitor/filesystem \
  @capacitor/splash-screen @capacitor/status-bar
npm install -D @capacitor/cli @capacitor/android

npm run build
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap sync android

echo "NOTE: Merge permissions from resources/android/AndroidManifest.permissions.xml into android/app/src/main/AndroidManifest.xml"
echo "Building release APK and Play Store AAB..."
(cd android && ./gradlew assembleRelease bundleRelease)

echo "Outputs:"
echo "  APK: android/app/build/outputs/apk/release/"
echo "  AAB: android/app/build/outputs/bundle/release/"
