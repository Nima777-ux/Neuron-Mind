import { getCapacitorBridge, isTauriRuntime } from './detectPlatform';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  if (isTauriRuntime() && window.__TAURI_INTERNALS__?.invoke) {
    try {
      const granted = await window.__TAURI_INTERNALS__.invoke<boolean>(
        'plugin:notification|is_permission_granted'
      );
      return granted ? 'granted' : 'prompt';
    } catch {
      // Fall through
    }
  }

  const capNotifications = getCapacitorBridge()?.Plugins?.LocalNotifications;
  if (capNotifications) {
    try {
      const status = await capNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      // Fall through
    }
  }

  if (!('Notification' in window)) return 'unsupported';
  if (window.Notification.permission === 'granted') return 'granted';
  if (window.Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  if (isTauriRuntime() && window.__TAURI_INTERNALS__?.invoke) {
    try {
      const state = await window.__TAURI_INTERNALS__.invoke<string>(
        'plugin:notification|request_permission'
      );
      return state === 'granted' ? 'granted' : 'denied';
    } catch {
      // Fall through
    }
  }

  const capNotifications = getCapacitorBridge()?.Plugins?.LocalNotifications;
  if (capNotifications) {
    try {
      const status = await capNotifications.requestPermissions();
      const capPush = getCapacitorBridge()?.Plugins?.PushNotifications;
      if (status.display === 'granted' && capPush) {
        await capPush.register().catch(() => undefined);
      }
      return status.display === 'granted' ? 'granted' : 'denied';
    } catch {
      // Fall through
    }
  }

  if (!('Notification' in window)) return 'unsupported';
  const result = await window.Notification.requestPermission();
  if (result === 'granted') return 'granted';
  if (result === 'denied') return 'denied';
  return 'prompt';
}

export async function sendLocalNotification(
  title: string,
  body: string
): Promise<boolean> {
  const permission = await getNotificationPermissionState();
  const finalPermission =
    permission === 'prompt' ? await requestNotificationPermission() : permission;
  if (finalPermission !== 'granted') return false;

  if (isTauriRuntime() && window.__TAURI_INTERNALS__?.invoke) {
    try {
      await window.__TAURI_INTERNALS__.invoke('plugin:notification|notify', {
        options: { title, body },
      });
      return true;
    } catch {
      // Fall through
    }
  }

  const capNotifications = getCapacitorBridge()?.Plugins?.LocalNotifications;
  if (capNotifications) {
    try {
      await capNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title,
            body,
          },
        ],
      });
      return true;
    } catch {
      // Fall through
    }
  }

  if ('Notification' in window) {
    new window.Notification(title, { body, icon: '/pwa-192x192.png' });
    return true;
  }

  return false;
}
