import { getCapacitorBridge, isTauriRuntime } from './detectPlatform';

const SESSION_META_KEY = 'neuron_mind_auth_session_v1';
const TAURI_STORE_RESOURCE = 'neuron_mind_secure.json';

export interface AuthSessionMetadata {
  uid: string;
  lastSignedInAt: string;
  platform: string;
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const capPrefs = getCapacitorBridge()?.Plugins?.Preferences;
    if (capPrefs) {
      try {
        await capPrefs.set({ key, value });
      } catch {
        // Fallback to localStorage below
      }
    }

    if (isTauriRuntime()) {
      try {
        await window.__TAURI_INTERNALS__?.invoke?.('plugin:store|set', {
          path: TAURI_STORE_RESOURCE,
          key,
          value,
        });
        await window.__TAURI_INTERNALS__?.invoke?.('plugin:store|save', {
          path: TAURI_STORE_RESOURCE,
        });
      } catch {
        // Fallback to localStorage below
      }
    }

    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota errors
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    const capPrefs = getCapacitorBridge()?.Plugins?.Preferences;
    if (capPrefs) {
      try {
        const res = await capPrefs.get({ key });
        if (typeof res?.value === 'string') return res.value;
      } catch {
        // Fall through
      }
    }

    if (isTauriRuntime()) {
      try {
        const val = await window.__TAURI_INTERNALS__?.invoke?.<unknown>(
          'plugin:store|get',
          {
            path: TAURI_STORE_RESOURCE,
            key,
          }
        );
        if (typeof val === 'string') return val;
      } catch {
        // Fall through
      }
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const capPrefs = getCapacitorBridge()?.Plugins?.Preferences;
    if (capPrefs) {
      try {
        await capPrefs.remove({ key });
      } catch {
        // Ignore
      }
    }

    if (isTauriRuntime()) {
      try {
        await window.__TAURI_INTERNALS__?.invoke?.('plugin:store|delete', {
          path: TAURI_STORE_RESOURCE,
          key,
        });
        await window.__TAURI_INTERNALS__?.invoke?.('plugin:store|save', {
          path: TAURI_STORE_RESOURCE,
        });
      } catch {
        // Ignore
      }
    }

    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },

  async saveAuthSessionMetadata(meta: AuthSessionMetadata): Promise<void> {
    await this.setItem(SESSION_META_KEY, JSON.stringify(meta));
  },

  async clearAuthSessionMetadata(): Promise<void> {
    await this.removeItem(SESSION_META_KEY);
  },
};
