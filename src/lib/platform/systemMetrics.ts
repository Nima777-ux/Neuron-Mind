import { buildApiUrl } from '../../config/runtimeEnv';

export interface SystemMetricsSnapshot {
  collectedAt: string;
  device: {
    online: boolean;
    cpuCores: number;
    deviceMemoryGb?: number;
    storageQuotaMb?: number;
    storageUsageMb?: number;
    networkType?: string;
    downlinkMbps?: number;
    jsHeapUsedMb?: number;
    batteryLevelPercent?: number;
    batteryCharging?: boolean;
    platform: string;
  };
  server?: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptimeSeconds: number;
    cpuCores: number;
    cpuModel: string;
    totalMemoryMb: number;
    freeMemoryMb: number;
    usedMemoryMb: number;
    processRssMb: number;
  };
  note: string;
}

export async function collectSystemMetrics(): Promise<SystemMetricsSnapshot> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number };
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  };

  let storageQuotaMb: number | undefined;
  let storageUsageMb: number | undefined;
  if (nav.storage?.estimate) {
    try {
      const est = await nav.storage.estimate();
      if (est.quota) storageQuotaMb = Math.round(est.quota / (1024 * 1024));
      if (est.usage) storageUsageMb = Math.round(est.usage / (1024 * 1024));
    } catch {
      // ignore storage estimate error
    }
  }

  let batteryLevelPercent: number | undefined;
  let batteryCharging: boolean | undefined;
  if (typeof nav.getBattery === 'function') {
    try {
      const bat = await nav.getBattery();
      batteryLevelPercent = Math.round(bat.level * 100);
      batteryCharging = bat.charging;
    } catch {
      // ignore battery unavailability
    }
  }

  const perfMem = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }
  ).memory;

  let serverStats: SystemMetricsSnapshot['server'] | undefined;
  if (nav.onLine) {
    try {
      const res = await fetch(buildApiUrl('/api/system/metrics'));
      if (res.ok) {
        const data = await res.json();
        serverStats = data.server;
      }
    } catch {
      // ignore offline or unreachable server
    }
  }

  return {
    collectedAt: new Date().toISOString(),
    device: {
      online: nav.onLine,
      cpuCores: nav.hardwareConcurrency || 0,
      deviceMemoryGb: nav.deviceMemory,
      storageQuotaMb,
      storageUsageMb,
      networkType: nav.connection?.effectiveType,
      downlinkMbps: nav.connection?.downlink,
      jsHeapUsedMb: perfMem
        ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024))
        : undefined,
      batteryLevelPercent,
      batteryCharging,
      platform: nav.platform || 'Browser',
    },
    server: serverStats,
    note: 'OS-wide background process listing and CPU kill actions are restricted inside the browser sandbox and require native Tauri system plugins.',
  };
}
