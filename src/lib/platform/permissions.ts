import {
  getNotificationPermissionState,
  type NotificationPermissionState,
} from './notifications';

export type MicrophonePermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export interface DevicePermissionsSnapshot {
  notifications: NotificationPermissionState;
  microphone: MicrophonePermissionState;
}

export async function getMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return 'unsupported';
  }

  if (navigator.permissions?.query) {
    try {
      const result = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  return 'prompt';
}

export async function getDevicePermissionsSnapshot(): Promise<DevicePermissionsSnapshot> {
  const [notifications, microphone] = await Promise.all([
    getNotificationPermissionState(),
    getMicrophonePermissionState(),
  ]);
  return { notifications, microphone };
}
