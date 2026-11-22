export type RuntimePlatform = 'web' | 'pwa' | 'ios' | 'android' | 'windows';

export interface CapacitorBridge {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: {
    Preferences?: {
      get: (opts: { key: string }) => Promise<{ value: string | null }>;
      set: (opts: { key: string; value: string }) => Promise<void>;
      remove: (opts: { key: string }) => Promise<void>;
    };
    LocalNotifications?: {
      checkPermissions: () => Promise<{ display: string }>;
      requestPermissions: () => Promise<{ display: string }>;
      schedule: (opts: {
        notifications: Array<{ id: number; title: string; body: string }>;
      }) => Promise<unknown>;
    };
    PushNotifications?: {
      checkPermissions: () => Promise<{ receive: string }>;
      requestPermissions: () => Promise<{ receive: string }>;
      register: () => Promise<void>;
    };
    Filesystem?: {
      writeFile: (opts: {
        path: string;
        data: string;
        directory: string;
        encoding: string;
      }) => Promise<{ uri: string }>;
    };
    Share?: {
      share: (opts: {
        title?: string;
        text?: string;
        url?: string;
      }) => Promise<unknown>;
    };
  };
}

export interface TauriInternalsBridge {
  invoke?: <T = unknown>(
    cmd: string,
    args?: Record<string, unknown>
  ) => Promise<T>;
}

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
    __TAURI_INTERNALS__?: TauriInternalsBridge;
  }
}

export interface PlatformProfile {
  platform: RuntimePlatform;
  isNativeShell: boolean;
  isMobileDevice: boolean;
  isDesktopShell: boolean;
  supportsNotifications: boolean;
  supportsSpeechRecognition: boolean;
  supportsNativeFileDialogs: boolean;
  supportsShare: boolean;
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.__TAURI_INTERNALS__?.invoke === 'function'
  );
}

export function getCapacitorBridge(): CapacitorBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Capacitor;
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return standaloneMedia || iosStandalone;
}

export function detectRuntimePlatform(): RuntimePlatform {
  if (typeof window === 'undefined') return 'web';

  if (isTauriRuntime()) {
    return 'windows';
  }

  const cap = getCapacitorBridge();
  if (cap?.isNativePlatform?.()) {
    const capPlatform = cap.getPlatform?.();
    if (capPlatform === 'ios') return 'ios';
    if (capPlatform === 'android') return 'android';
  }

  if (isStandalonePWA()) {
    return 'pwa';
  }

  return 'web';
}

export function getPlatformProfile(): PlatformProfile {
  const platform = detectRuntimePlatform();
  const isNativeShell =
    platform === 'ios' || platform === 'android' || platform === 'windows';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  const isMobileDevice =
    platform === 'ios' || platform === 'android' || isMobileUa;
  const isDesktopShell = platform === 'windows';

  const hasWebNotifications =
    typeof window !== 'undefined' && 'Notification' in window;
  const hasCapNotifications = Boolean(
    getCapacitorBridge()?.Plugins?.LocalNotifications
  );
  const supportsNotifications =
    isTauriRuntime() || hasCapNotifications || hasWebNotifications;

  const win =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, unknown>)
      : {};
  const supportsSpeechRecognition = Boolean(
    win.SpeechRecognition || win.webkitSpeechRecognition
  );

  const supportsNativeFileDialogs = isTauriRuntime();
  const supportsShare =
    Boolean(getCapacitorBridge()?.Plugins?.Share) ||
    (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  return {
    platform,
    isNativeShell,
    isMobileDevice,
    isDesktopShell,
    supportsNotifications,
    supportsSpeechRecognition,
    supportsNativeFileDialogs,
    supportsShare,
  };
}
