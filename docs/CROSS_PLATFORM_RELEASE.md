# Neuron Mind — Complete Installation, Offline Usage & Cross-Platform Build Guide

This guide explains how to install **Neuron Mind** on **Windows 10/11**, **Android**, and **iPhone / iPad (iOS)**, how full **Offline Mode** works, and how to compile native store binaries (`.msi`/`.exe`, `.apk`/`.aab`, `.ipa`).

---

## 1. How Offline Mode Works on Mobile & Computer

Once Neuron Mind is installed on Windows, Android, or iOS:
1. **App Shell Cached Offline**: The Service Worker precaches all UI scripts, styles, fonts, icons, and pages so the app opens instantly with zero internet connection.
2. **Offline Local Task & Command Engine (`offline-local-engine`)**:
   - In the **Assistant** chat while offline, you can still create/complete/delete tasks, schedule calendar events, save notes/files, store memories, create automations, and list your agenda in **English or Persian** (for example: `Add task Buy milk tomorrow high priority` or `وظیفه جدید خرید نان فردا اولویت زیاد`).
   - All five workspace tabs (**Tasks**, **Calendar**, **Files**, **Memory**, **Automations**) work 100% offline with IndexedDB + local cache persistence.
3. **Automatic Cloud Sync**: Every offline change is stored in the local pending queue and Firestore persistent cache (`persistentLocalCache`) and automatically syncs to your account when internet returns. *(Note: Cloud Gemini LLM reasoning requires internet; local task/command execution works offline without fabricating cloud AI calls.)*

---

## 2. Windows 10 & Windows 11 Installation

### Method 1 — Instant Offline Desktop App (Recommended Today, ~30 Seconds)
1. Open **Microsoft Edge** or **Google Chrome** on Windows and go to your Neuron Mind app URL.
2. Click the **Install App** button inside Neuron Mind (**Sidebar** or **Settings**) or click the **Install** icon in your browser's address bar.
   - Alternatively, download **`neuron-mind-windows-kit.zip`** from **Settings > Installers & Platform Packages**, extract it, right-click `scripts/install-windows-offline-app.ps1`, and choose **Run with PowerShell**.
3. Pin **Neuron Mind** to your **Start Menu** or **Taskbar**. Open it once while online so the offline cache initializes, then use it anytime offline.

### Method 2 — Native Windows `.msi` & `.exe` Setup Installer (Tauri v2)
1. Install **Node.js 20+**, **Rust** (`https://rustup.rs`), and **Visual Studio C++ Build Tools**.
2. Extract the full repository (including `src-tauri/` and `scripts/`), open PowerShell in the project folder, and run:
   ```powershell
   .\scripts\build-windows.ps1 -ApiBaseUrl "https://YOUR_HOSTED_SERVER_URL"
   ```
3. Run the generated `.msi` or `.exe` installer located in `src-tauri\target\release\bundle\`.
4. **MSIX / Microsoft Store**: Package the built executable with `makeappx.exe` and sign with your Windows code-signing certificate (`certificateThumbprint` in `src-tauri/tauri.conf.json`).

---

## 3. Android Phone & Tablet Installation

### Method 1 — Instant Offline Android App (No PC Needed)
1. Open **Google Chrome** on your Android phone or tablet and navigate to your Neuron Mind app URL.
2. Tap **Install App** inside Neuron Mind (or tap Chrome's **⋮ Menu → Install App / Add to Home screen**).
3. Wait a few seconds for the offline Service Worker cache to finish.
4. Launch **Neuron Mind** from your Home Screen or App Drawer — it runs full-screen and works completely offline.

### Method 2 — Native `.apk` & Google Play `.aab` (Capacitor)
1. Install **Node.js 20+**, **JDK 17+**, and **Android Studio (SDK 34+)**.
2. Run from the repository root:
   ```bash
   bash scripts/build-android.sh "https://YOUR_HOSTED_SERVER_URL"
   ```
3. Merge permissions from `resources/android/AndroidManifest.permissions.xml` into `android/app/src/main/AndroidManifest.xml`, and place Firebase `google-services.json` in `android/app/` if using FCM push notifications.
4. Install the `.apk` directly (`android/app/build/outputs/apk/release/`) or sign and upload the `.aab` (`android/app/build/outputs/bundle/release/`) to Google Play Console.

---

## 4. iPhone & iPad (iOS) Installation

### Method 1 — Instant Offline iOS App (No Mac Needed)
1. Open **Safari** on your iPhone or iPad *(important: use Safari, as Apple requires Safari for Home Screen Web Apps)* and visit your Neuron Mind app URL.
2. Tap the **Share** icon (`[↑]`) at the bottom (iPhone) or top (iPad) of Safari.
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.
4. Open **Neuron Mind** from your Home Screen. Wait briefly once while online so offline assets cache; afterward it opens full-screen without Safari bars and works offline.

### Method 2 — Native Xcode / TestFlight / App Store `.ipa` (Capacitor)
1. On a Mac with **Xcode 15+**, **CocoaPods**, and an Apple Developer account, run:
   ```bash
   bash scripts/build-ios.sh "https://YOUR_HOSTED_SERVER_URL"
   ```
2. Merge privacy keys (`NSMicrophoneUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `UIBackgroundModes`) from `resources/ios/Info.plist.additions.xml` into `ios/App/App/Info.plist`.
3. In Xcode, select your **Team & Signing**, test on iPhone/iPad, and run **Product → Archive** to distribute via TestFlight / App Store or export an `.ipa`.

---

## 5. Automated Cloud Builds for `.msi`, `.exe`, `.apk`, `.aab` & `.xcarchive` (GitHub Actions)

If you do not have a Mac or Android Studio installed locally, push this project to GitHub and trigger **Actions → Build Native Installers (Windows, Android, iOS)** (`.github/workflows/build-native-installers.yml`). GitHub's cloud runners automatically build and attach downloadable artifacts for all three platforms.
