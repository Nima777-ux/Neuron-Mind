import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { buildMultiSizeIcoFromPngs, type IcoPngImageInput } from '../utils/icoBuilder.ts';
import { buildZipBuffer, type ZipEntryInput } from '../utils/zipBuilder.ts';

function toCrlfBuffer(text: string): Buffer {
  const normalized = text.replace(/\r?\n/g, '\r\n');
  return Buffer.from(normalized, 'utf8');
}

function readProjectFiles(
  projectRoot: string,
  mappings: Array<{ src: string; dest?: string; crlf?: boolean }>
): ZipEntryInput[] {
  const entries: ZipEntryInput[] = [];
  for (const item of mappings) {
    const abs = path.resolve(projectRoot, item.src);
    if (!abs.startsWith(projectRoot) || !fs.existsSync(abs)) continue;
    const content = item.crlf
      ? toCrlfBuffer(fs.readFileSync(abs, 'utf8'))
      : fs.readFileSync(abs);
    entries.push({
      name: item.dest ?? item.src,
      content,
    });
  }
  return entries;
}

function readDistBundleEntries(
  projectRoot: string,
  targetPrefix = 'app'
): ZipEntryInput[] {
  const distDir = path.resolve(projectRoot, 'dist');
  if (!fs.existsSync(distDir)) return [];

  const entries: ZipEntryInput[] = [];
  const walk = (dir: string) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, dirent.name);
      const relFromDist = path.relative(distDir, fullPath).replace(/\\/g, '/');
      if (relFromDist.startsWith('assets/aistudio')) {
        continue;
      }
      if (dirent.isDirectory()) {
        walk(fullPath);
      } else if (dirent.isFile()) {
        entries.push({
          name: `${targetPrefix}/${relFromDist}`,
          content: fs.readFileSync(fullPath),
        });
      }
    }
  };
  walk(distDir);
  return entries;
}

function resolvePublicAppUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  const host = req.get('host');
  const proto =
    req.headers['x-forwarded-proto']?.toString().split(',')[0] ||
    req.protocol ||
    'https';
  return host
    ? `${proto}://${host}`
    : 'https://ais-pre-3cysbecvm4thgw3c4bg56j-545566137884.europe-west2.run.app';
}

export function createDownloadRouter(projectRoot: string): Router {
  const router = Router();

  router.get('/windows-kit', (req: Request, res: Response) => {
    const appUrl = resolvePublicAppUrl(req);
    const entries: ZipEntryInput[] = [];

    // 1. Double-clickable root installer, offline launcher, uninstaller & icon
    entries.push({
      name: 'Install-Neuron-Mind.cmd',
      content: toCrlfBuffer(
        `@echo off\r\n` +
          `setlocal\r\n` +
          `cd /d "%~dp0"\r\n` +
          `echo Launching Neuron Mind Windows Desktop Installer...\r\n` +
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\install-windows-desktop-app.ps1" -AppUrl "${appUrl}"\r\n` +
          `if errorlevel 1 (\r\n` +
          `  echo.\r\n` +
          `  echo Installation encountered an issue. Press any key to close...\r\n` +
          `  pause >nul\r\n` +
          `)\r\n`
      ),
    });

    entries.push(
      ...readProjectFiles(projectRoot, [
        { src: 'scripts/Launch-Offline-Now.cmd', dest: 'Launch-Offline-Now.cmd', crlf: true },
        { src: 'scripts/Uninstall-Neuron-Mind.cmd', dest: 'Uninstall-Neuron-Mind.cmd', crlf: true },
        { src: 'scripts/install-windows-desktop-app.ps1', crlf: true },
        { src: 'scripts/launch-neuron-mind.ps1', crlf: true },
        { src: 'scripts/build-windows.ps1', crlf: true },
        { src: 'src-tauri/tauri.conf.json', dest: 'native-tauri-source/src-tauri/tauri.conf.json' },
        { src: 'src-tauri/Cargo.toml', dest: 'native-tauri-source/src-tauri/Cargo.toml' },
        { src: 'src-tauri/build.rs', dest: 'native-tauri-source/src-tauri/build.rs' },
        { src: 'src-tauri/src/lib.rs', dest: 'native-tauri-source/src-tauri/src/lib.rs' },
        { src: 'src-tauri/src/main.rs', dest: 'native-tauri-source/src-tauri/src/main.rs' },
        { src: 'src-tauri/capabilities/default.json', dest: 'native-tauri-source/src-tauri/capabilities/default.json' },
        { src: '.github/workflows/build-native-installers.yml', dest: 'native-tauri-source/.github/workflows/build-native-installers.yml' },
        { src: '.env.example', dest: 'native-tauri-source/.env.example' },
        { src: 'docs/CROSS_PLATFORM_RELEASE.md', dest: 'docs/CROSS_PLATFORM_RELEASE.md' },
      ])
    );

    // 2. Real multi-resolution Windows .ico icon built from HD PNGs
    const icoInputs: IcoPngImageInput[] = [];
    const iconCandidates: Array<{ file: string; size: number }> = [
      { file: 'public/pwa-256x256.png', size: 256 },
      { file: 'public/pwa-192x192.png', size: 192 },
      { file: 'public/favicon-32x32.png', size: 32 },
    ];
    for (const candidate of iconCandidates) {
      const absIcon = path.resolve(projectRoot, candidate.file);
      if (fs.existsSync(absIcon)) {
        icoInputs.push({
          buffer: fs.readFileSync(absIcon),
          width: candidate.size,
          height: candidate.size,
        });
      }
    }
    if (icoInputs.length > 0) {
      entries.push({ name: 'neuron-mind.ico', content: buildMultiSizeIcoFromPngs(icoInputs) });
    }

    // 3. Bundled compiled standalone offline application inside app/
    entries.push(...readDistBundleEntries(projectRoot, 'app'));

    // 4. Clear Windows quick-start guide
    entries.push({
      name: 'WINDOWS_INSTALL_GUIDE.md',
      content:
        `# Neuron Mind — Windows 10 & 11 Desktop App\n\n` +
        `## How to Install on Windows (1-Click)\n` +
        `1. Extract ALL files from this zip folder (right-click -> Extract All).\n` +
        `2. Double-click **Install-Neuron-Mind.cmd**.\n` +
        `   - Installs the bundled offline application into \`%LocalAppData%\\NeuronMind\\\`.\n` +
        `   - Adds **Neuron Mind** to your **Desktop**, **Start Menu**, and **Windows Apps & Features**.\n` +
        `   - Automatically launches online when connected and switches seamlessly to the bundled local offline app when offline.\n\n` +
        `## Launch Without Installing\n` +
        `- Double-click **Launch-Offline-Now.cmd** to run the bundled offline desktop app immediately from this folder.\n\n` +
        `## Uninstall Anytime\n` +
        `- Double-click **Uninstall-Neuron-Mind.cmd** or remove **Neuron Mind** from Windows Settings -> Installed apps.\n\n` +
        `## Optional: Compile Native Signed .msi / .exe (Tauri v2)\n` +
        `- Copy \`native-tauri-source\\src-tauri\` into the full project repository and run \`scripts\\build-windows.ps1\` with Rust + Node.js installed.\n`,
    });

    const zip = buildZipBuffer(entries);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(zip.length));
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="neuron-mind-windows-kit.zip"'
    );
    res.send(zip);
  });

  router.get('/android-kit', (req: Request, res: Response) => {
    const appUrl = resolvePublicAppUrl(req);
    const entries: ZipEntryInput[] = [
      ...readProjectFiles(projectRoot, [
        { src: 'scripts/build-android.sh' },
        { src: 'capacitor.config.ts' },
        { src: 'resources/android/AndroidManifest.permissions.xml' },
        { src: '.github/workflows/build-native-installers.yml' },
        { src: '.env.example' },
        { src: 'docs/CROSS_PLATFORM_RELEASE.md' },
      ]),
      ...readDistBundleEntries(projectRoot, 'app'),
    ];

    entries.push({
      name: 'ANDROID_INSTALL_GUIDE.md',
      content:
        `# Neuron Mind — Android Phone & Tablet Installation Guide\n\n` +
        `## Option A: Instant Offline Android App (No Computer Needed)\n` +
        `1. Open Google Chrome on your Android phone or tablet and visit:\n   ${appUrl}\n` +
        `2. Tap "Install App" inside Neuron Mind (or Chrome Menu > Install App / Add to Home screen).\n` +
        `3. Wait 5 seconds while the Service Worker caches the app for offline use.\n` +
        `4. Launch Neuron Mind from your Home Screen or App Drawer. Tasks, calendar, notes, memory, automations, and offline chat commands all work without internet and sync once online.\n\n` +
        `## Option B: Build Installable .apk / Google Play .aab (Capacitor)\n` +
        `1. Install Node.js 20+, JDK 17+, and Android Studio (SDK 34+).\n` +
        `2. From the full repository root run:\n   bash scripts/build-android.sh "${appUrl}"\n` +
        `3. Output paths:\n   - Sideload APK: android/app/build/outputs/apk/release/\n   - Play Store AAB: android/app/build/outputs/bundle/release/\n`,
    });

    const zip = buildZipBuffer(entries);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(zip.length));
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="neuron-mind-android-kit.zip"'
    );
    res.send(zip);
  });

  router.get('/ios-kit', (req: Request, res: Response) => {
    const appUrl = resolvePublicAppUrl(req);
    const entries: ZipEntryInput[] = [
      ...readProjectFiles(projectRoot, [
        { src: 'scripts/build-ios.sh' },
        { src: 'capacitor.config.ts' },
        { src: 'resources/ios/Info.plist.additions.xml' },
        { src: '.github/workflows/build-native-installers.yml' },
        { src: '.env.example' },
        { src: 'docs/CROSS_PLATFORM_RELEASE.md' },
      ]),
      ...readDistBundleEntries(projectRoot, 'app'),
    ];

    entries.push({
      name: 'IOS_INSTALL_GUIDE.md',
      content:
        `# Neuron Mind — iPhone & iPad (iOS) Installation Guide\n\n` +
        `## Option A: Instant Offline iPhone / iPad App (No Mac Needed)\n` +
        `1. Open Safari on your iPhone or iPad (must be Safari) and visit:\n   ${appUrl}\n` +
        `2. Tap the Share button (square with upward arrow) in Safari.\n` +
        `3. Scroll down and tap "Add to Home Screen", then tap "Add".\n` +
        `4. Open Neuron Mind from your Home Screen. It launches full-screen without Safari bars and caches tasks, calendar, files, memory, automations, and local task commands offline.\n\n` +
        `## Option B: Build Native Xcode / App Store .ipa (Capacitor)\n` +
        `1. On a Mac with Xcode 15+ and CocoaPods, from the full repository root run:\n   bash scripts/build-ios.sh "${appUrl}"\n` +
        `2. Merge privacy keys from \`resources/ios/Info.plist.additions.xml\` into \`ios/App/App/Info.plist\`.\n` +
        `3. In Xcode, choose your Apple Developer Team and run Product > Archive to export an \`.ipa\` or upload to App Store Connect / TestFlight.\n`,
    });

    const zip = buildZipBuffer(entries);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(zip.length));
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="neuron-mind-ios-kit.zip"'
    );
    res.send(zip);
  });

  router.get('/full-guide', (_req: Request, res: Response) => {
    const guidePath = path.resolve(
      projectRoot,
      'docs/CROSS_PLATFORM_RELEASE.md'
    );
    if (!fs.existsSync(guidePath)) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Guide not found.' } });
      return;
    }
    const content = fs.readFileSync(guidePath, 'utf8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="NEURON_MIND_INSTALL_GUIDE.md"'
    );
    res.send(content);
  });

  return router;
}
