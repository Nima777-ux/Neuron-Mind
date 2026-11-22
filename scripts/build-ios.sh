#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${1:-https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app}"

echo "=== Preparing Neuron Mind iOS Project for Xcode / .ipa ==="
export VITE_API_BASE_URL="$API_BASE_URL"

npm install
npm install @capacitor/core @capacitor/app @capacitor/haptics @capacitor/keyboard \
  @capacitor/local-notifications @capacitor/network @capacitor/preferences \
  @capacitor/push-notifications @capacitor/share @capacitor/filesystem \
  @capacitor/splash-screen @capacitor/status-bar
npm install -D @capacitor/cli @capacitor/ios

npm run build
if [ ! -d "ios" ]; then
  npx cap add ios
fi
npx cap sync ios

echo "NOTE: Merge privacy keys from resources/ios/Info.plist.additions.xml into ios/App/App/Info.plist"
echo "Opening Xcode... Select your Apple Developer Team and run Product > Archive to export the .ipa or submit to App Store Connect."
npx cap open ios
