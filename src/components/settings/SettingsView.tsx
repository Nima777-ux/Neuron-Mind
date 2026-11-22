import { Bell, Cpu, Download, LogIn, LogOut, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../../config/runtimeEnv';
import { useLanguage } from '../../i18n/languageContext';
import { useAuth } from '../../lib/firebase/authContext';
import { FIRESTORE_COLLECTIONS } from '../../lib/firebase/types';
import {
  getDevicePermissionsSnapshot,
  getPlatformProfile,
  requestNotificationPermission,
  sendLocalNotification,
  type DevicePermissionsSnapshot,
  type NotificationPermissionState,
} from '../../lib/platform';
import {
  collectSystemMetrics,
  type SystemMetricsSnapshot,
} from '../../lib/platform/systemMetrics';
import { useTheme } from '../../lib/theme/themeContext';
import type {
  AgentModuleDescriptor,
  SystemReadiness,
} from '../../types/assistant';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface SettingsViewProps {
  readiness: SystemReadiness | null;
  modules: AgentModuleDescriptor[];
  isOnline: boolean;
  pendingCount: number;
  conflictCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  onSyncNow: () => void;
  connectedFoldersCount: number;
  vaultUnlocked: boolean;
}

export function SettingsView({
  readiness,
  modules,
  isOnline,
  pendingCount,
  conflictCount,
  isSyncing,
  lastSyncedAt,
  syncError,
  onSyncNow,
  connectedFoldersCount,
  vaultUnlocked,
}: SettingsViewProps) {
  const {
    language,
    setLanguage,
    autoDetectLanguage,
    setAutoDetectLanguage,
    t,
    formatDateTime,
    formatNumber,
  } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { status: authStatus, user, authError, signInWithGoogle, signOut } =
    useAuth();
  const collections =
    readiness?.firebase.plannedCollections ?? Object.values(FIRESTORE_COLLECTIONS);

  const platformProfile = useMemo(() => getPlatformProfile(), []);
  const [permissions, setPermissions] = useState<DevicePermissionsSnapshot>({
    notifications: 'prompt',
    microphone: 'prompt',
  });
  const [notificationFeedback, setNotificationFeedback] = useState<string | null>(
    null
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SystemMetricsSnapshot | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const refreshMetrics = async () => {
    setMetricsLoading(true);
    try {
      const snap = await collectSystemMetrics();
      setMetrics(snap);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    void getDevicePermissionsSnapshot().then(setPermissions);
    void refreshMetrics();
  }, []);

  const platformLabelMap = {
    web: t.settings.platformWeb,
    pwa: t.settings.platformPwa,
    ios: t.settings.platformIos,
    android: t.settings.platformAndroid,
    windows: t.settings.platformWindows,
  };

  const renderPermissionLabel = (state: NotificationPermissionState) => {
    switch (state) {
      case 'granted':
        return t.settings.permGranted;
      case 'denied':
        return t.settings.permDenied;
      case 'unsupported':
        return t.settings.permUnsupported;
      default:
        return t.settings.permPrompt;
    }
  };

  const handleEnableNotifications = async () => {
    setNotificationFeedback(null);
    const result = await requestNotificationPermission();
    const updated = await getDevicePermissionsSnapshot();
    setPermissions(updated);
    if (result !== 'granted') {
      setNotificationFeedback(t.settings.notificationBlockedNotice);
    }
  };

  const handleTestNotification = async () => {
    setNotificationFeedback(null);
    const sent = await sendLocalNotification(
      t.settings.testNotificationTitle,
      t.settings.testNotificationBody
    );
    const updated = await getDevicePermissionsSnapshot();
    setPermissions(updated);
    setNotificationFeedback(
      sent
        ? t.settings.notificationSentNotice
        : t.settings.notificationBlockedNotice
    );
  };

  const handleDownloadPackage = async (
    id: string,
    endpoint: string,
    filename: string,
    expectZip: boolean
  ) => {
    setDownloadError(null);
    setDownloadingId(id);
    try {
      const response = await fetch(buildApiUrl(endpoint), {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (expectZip) {
        const isPkZip =
          bytes.length > 30 &&
          bytes[0] === 0x50 &&
          bytes[1] === 0x4b &&
          bytes[2] === 0x03 &&
          bytes[3] === 0x04;
        if (!isPkZip) {
          throw new Error('INVALID_ZIP');
        }
      }
      const blob = new Blob([bytes], {
        type: expectZip ? 'application/zip' : 'text/markdown;charset=utf-8',
      });
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch {
      setDownloadError(t.settings.downloadFailedError);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <section className="space-y-2">
          <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">
            {t.settings.kicker}
          </p>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
            {t.settings.title}
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {t.settings.subtitle}
          </p>
        </section>

        <section className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-5">
          <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
            {t.settings.languageSectionTitle}
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">
              {t.settings.themeLabel}
            </span>
            <div
              role="group"
              aria-label={t.settings.themeLabel}
              className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#EFF4FB] dark:bg-[#09142B] border border-blue-900/15 dark:border-blue-400/20 min-w-[200px]"
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
                className={`min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-[#0B1B3B] shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
                }`}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.settings.dayMode}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#162F61] text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
                }`}
              >
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.settings.nightMode}</span>
              </button>
            </div>
          </div>
          <div className="pt-4 border-t border-blue-950/10 dark:border-blue-400/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label htmlFor="language-select" className="text-sm text-slate-700 dark:text-slate-200 font-medium">
              {t.settings.languageLabel}
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'fa' ? 'fa' : 'en')}
              className="min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 font-medium"
            >
              <option value="en" className="bg-white dark:bg-[#0D1B36]">{t.settings.languageEnglish}</option>
              <option value="fa" className="bg-white dark:bg-[#0D1B36]">{t.settings.languagePersian}</option>
            </select>
          </div>
          <div className="pt-4 border-t border-blue-950/10 dark:border-blue-400/15 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-[#0B1B3B] dark:text-slate-100">
                {t.settings.autoDetectLabel}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{t.settings.autoDetectDesc}</p>
            </div>
            <input
              type="checkbox"
              checked={autoDetectLanguage}
              onChange={(e) => setAutoDetectLanguage(e.target.checked)}
              aria-label={t.settings.autoDetectLabel}
              className="h-5 w-5 accent-[#102A5C] dark:accent-blue-500 rounded cursor-pointer shrink-0"
            />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.accountSectionTitle}
              </h3>
              <span className="text-xs font-medium text-[#1E3A8A] dark:text-blue-300">
                {authStatus === 'authenticated'
                  ? t.auth.signedIn
                  : t.auth.localWorkspace}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {authStatus === 'authenticated'
                ? `${user?.displayName || ''} · ${user?.email || ''}`
                : t.auth.signInPrompt}
            </p>
            {authError ? (
              <p className="text-xs text-red-700 dark:text-red-300">{authError}</p>
            ) : null}
            <div>
              {authStatus === 'authenticated' ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] rounded-lg"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>{t.auth.signOut}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>{t.auth.signInWithGoogle}</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.offlineSyncSectionTitle}
              </h3>
              <span
                className={`text-xs font-medium ${
                  isOnline ? 'text-green-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {isOnline ? t.topbar.online : t.topbar.offline}
              </span>
            </div>
            <dl className="divide-y divide-blue-950/10 dark:divide-blue-400/15 text-sm">
              <div className="py-2 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t.settings.pendingCountLabel}</dt>
                <dd className="font-mono tabular-nums text-xs text-[#102A5C] dark:text-blue-300">
                  {formatNumber(pendingCount)}
                </dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t.settings.conflictsResolvedLabel}</dt>
                <dd className="font-mono tabular-nums text-xs text-[#102A5C] dark:text-blue-300">
                  {formatNumber(conflictCount)}
                </dd>
              </div>
              {lastSyncedAt ? (
                <div className="py-2 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">{t.offline.lastSynced}</dt>
                  <dd className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                    {formatDateTime(lastSyncedAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
            {syncError ? (
              <p className="text-xs text-red-700 dark:text-red-300">
                {t.offline.syncFailedPrefix} {syncError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSyncNow}
                disabled={!isOnline || isSyncing || pendingCount === 0}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] disabled:opacity-50 rounded-lg"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSyncing ? t.topbar.syncing : t.settings.syncButton}</span>
              </button>
              <PWAInstallButton variant="full" />
            </div>
          </div>
        </section>

        <section className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.settings.platformSectionTitle}
            </h3>
            <span className="text-xs font-medium text-[#1E3A8A] dark:text-blue-300">
              {platformLabelMap[platformProfile.platform]}
            </span>
          </div>
          <dl className="divide-y divide-blue-950/10 dark:divide-blue-400/15 text-sm">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.runtimePlatformLabel}</dt>
              <dd className="font-mono text-xs text-[#102A5C] dark:text-blue-300">
                {platformLabelMap[platformProfile.platform]}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.notificationPermLabel}</dt>
              <dd className="text-xs font-medium text-[#102A5C] dark:text-blue-300">
                {renderPermissionLabel(permissions.notifications)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.microphonePermLabel}</dt>
              <dd className="text-xs font-medium text-[#102A5C] dark:text-blue-300">
                {renderPermissionLabel(permissions.microphone)}
              </dd>
            </div>
          </dl>
          {notificationFeedback ? (
            <p className="text-xs text-slate-700 dark:text-slate-300">{notificationFeedback}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {permissions.notifications !== 'granted' ? (
              <button
                type="button"
                onClick={() => void handleEnableNotifications()}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span>{t.settings.enableNotificationsButton}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleTestNotification()}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] rounded-lg"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span>{t.settings.testNotificationButton}</span>
            </button>
          </div>
        </section>

        <section className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.settings.securitySectionTitle}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.securitySectionDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshMetrics()}
              disabled={metricsLoading}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] rounded-lg whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${metricsLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{t.settings.refreshTelemetry}</span>
            </button>
          </div>

          <dl className="divide-y divide-blue-950/10 dark:divide-blue-400/15 text-sm">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.connectedFoldersCount}</dt>
              <dd className="font-mono tabular-nums text-xs font-semibold text-[#102A5C] dark:text-blue-300">
                {formatNumber(connectedFoldersCount)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.clipboardPermLabel}</dt>
              <dd className="text-xs font-medium text-[#102A5C] dark:text-blue-300">
                {typeof navigator !== 'undefined' && navigator.clipboard
                  ? t.settings.permGranted
                  : t.settings.permUnsupported}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.vaultStatusLabel}</dt>
              <dd
                className={`text-xs font-medium ${
                  vaultUnlocked ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#102A5C] dark:text-blue-300'
                }`}
              >
                {vaultUnlocked ? t.settings.vaultUnlockedStatus : t.settings.vaultLockedStatus}
              </dd>
            </div>
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="text-slate-500 dark:text-slate-400">{t.settings.deleteConfirmPolicyLabel}</dt>
              <dd className="text-xs text-slate-700 dark:text-slate-300">{t.settings.deleteConfirmPolicyDesc}</dd>
            </div>
          </dl>

          {metrics ? (
            <div className="pt-3 border-t border-blue-950/10 dark:border-blue-400/15 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                <Cpu className="h-3.5 w-3.5 text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
                <span>{t.settings.systemTelemetryTitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">{t.settings.cpuCoresLabel}</p>
                  <p className="font-mono tabular-nums font-semibold text-[#102A5C] dark:text-blue-300">
                    {formatNumber(metrics.device.cpuCores)} /{' '}
                    {metrics.server ? formatNumber(metrics.server.cpuCores) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">{t.settings.memoryLabel}</p>
                  <p className="font-mono tabular-nums font-semibold text-[#102A5C] dark:text-blue-300">
                    {metrics.server
                      ? `${formatNumber(metrics.server.usedMemoryMb)} / ${formatNumber(metrics.server.totalMemoryMb)} MB`
                      : metrics.device.deviceMemoryGb
                        ? `${formatNumber(metrics.device.deviceMemoryGb)} GB`
                        : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-1">
                  <p className="text-slate-500 dark:text-slate-400">{t.settings.storageQuotaLabel}</p>
                  <p className="font-mono tabular-nums font-semibold text-[#102A5C] dark:text-blue-300">
                    {metrics.device.storageQuotaMb
                      ? `${formatNumber(metrics.device.storageUsageMb ?? 0)} / ${formatNumber(metrics.device.storageQuotaMb)} MB`
                      : '—'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{metrics.note}</p>
            </div>
          ) : null}
        </section>

        <section className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-5">
          <div className="space-y-1.5">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.settings.downloadsSectionTitle}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.settings.downloadsSectionDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!isOnline || downloadingId !== null}
              onClick={() =>
                void handleDownloadPackage(
                  'windows',
                  '/api/downloads/windows-kit',
                  'neuron-mind-windows-kit.zip',
                  true
                )
              }
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t.settings.downloadWindowsKit}</span>
            </button>
            <button
              type="button"
              disabled={!isOnline || downloadingId !== null}
              onClick={() =>
                void handleDownloadPackage(
                  'android',
                  '/api/downloads/android-kit',
                  'neuron-mind-android-kit.zip',
                  true
                )
              }
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] disabled:opacity-50 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t.settings.downloadAndroidKit}</span>
            </button>
            <button
              type="button"
              disabled={!isOnline || downloadingId !== null}
              onClick={() =>
                void handleDownloadPackage(
                  'ios',
                  '/api/downloads/ios-kit',
                  'neuron-mind-ios-kit.zip',
                  true
                )
              }
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] disabled:opacity-50 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t.settings.downloadIosKit}</span>
            </button>
            <button
              type="button"
              disabled={!isOnline || downloadingId !== null}
              onClick={() =>
                void handleDownloadPackage(
                  'guide',
                  '/api/downloads/full-guide',
                  'NEURON_MIND_INSTALL_GUIDE.md',
                  false
                )
              }
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#09142B] border border-blue-900/15 dark:border-blue-400/25 hover:bg-slate-50 dark:hover:bg-[#132852] disabled:opacity-50 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t.settings.downloadFullGuide}</span>
            </button>
          </div>
          {downloadError ? (
            <p className="text-xs text-red-700 dark:text-red-300">{downloadError}</p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-blue-950/10 dark:border-blue-400/15">
            <div className="p-4 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-2">
              <h4 className="font-display text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.windowsGuideTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.windowsGuideStep1}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.windowsGuideStep2}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-2">
              <h4 className="font-display text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.androidGuideTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.androidGuideStep1}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.androidGuideStep2}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-2">
              <h4 className="font-display text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.iosGuideTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.iosGuideStep1}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.settings.iosGuideStep2}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.settings.nativeCompileNote}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.geminiSectionTitle}
              </h3>
              <span
                className={`text-xs font-medium ${
                  readiness?.gemini.configured ? 'text-green-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {readiness
                  ? readiness.gemini.configured
                    ? t.settings.configured
                    : t.settings.notConfigured
                  : t.settings.checking}
              </span>
            </div>
            <dl className="divide-y divide-blue-950/10 dark:divide-blue-400/15 text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t.settings.executionMode}</dt>
                <dd className="font-mono text-xs text-[#102A5C] dark:text-blue-300">
                  {t.settings.serverSideSdk}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t.settings.defaultModel}</dt>
                <dd className="font-mono text-xs text-[#102A5C] dark:text-blue-300">
                  {readiness?.gemini.model ?? 'gemini-4-hydrogen'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t.settings.credentialSource}</dt>
                <dd className="text-xs text-slate-700 dark:text-slate-300">{t.settings.secretsPanel}</dd>
              </div>
            </dl>
          </div>

          <div className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                {t.settings.firebaseSectionTitle}
              </h3>
              <span className="text-xs font-medium text-green-700 dark:text-emerald-400">
                {t.settings.configured}
              </span>
            </div>
            <dl className="divide-y divide-blue-950/10 dark:divide-blue-400/15 text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t.settings.activeSessionStore}</dt>
                <dd className="text-xs text-[#102A5C] dark:text-blue-300">
                  {t.settings.firestoreWithCache}
                </dd>
              </div>
              <div className="py-2.5 flex items-start justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400 shrink-0">
                  {t.settings.plannedCollections}
                </dt>
                <dd className="font-mono text-xs text-slate-700 dark:text-slate-300 text-end">
                  {collections.join(', ')}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.settings.registryTitle}
            </h3>
            <span className="font-mono tabular-nums text-xs text-[#1E3A8A]/75 dark:text-blue-300/75">
              {formatNumber(modules.length)} {t.settings.totalLabel}
            </span>
          </div>
          <div className="overflow-x-auto border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl">
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="border-b border-blue-950/10 dark:border-blue-400/15 bg-[#EFF4FB] dark:bg-[#132852] text-xs font-medium text-[#102A5C] dark:text-blue-200">
                  <th className="py-2.5 px-4 text-start">{t.settings.colModule}</th>
                  <th className="py-2.5 px-4 text-start">{t.settings.colId}</th>
                  <th className="py-2.5 px-4 text-end">{t.settings.colTools}</th>
                  <th className="py-2.5 px-4 text-end">{t.settings.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-950/10 dark:divide-blue-400/15">
                {modules.map((mod) => (
                  <tr key={mod.id} className="hover:bg-[#F5F8FD] dark:hover:bg-[#132852]/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-[#0B1B3B] dark:text-slate-100">
                      {t.nav[mod.domain]}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {mod.id}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#102A5C] dark:text-blue-300 text-end">
                      {formatNumber(mod.capabilities.length)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 text-end whitespace-nowrap">
                      {mod.status === 'connected'
                        ? t.chat.statusConnected
                        : t.chat.statusReady}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
