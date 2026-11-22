import { useCallback, useEffect, useRef, useState } from 'react';
import { detectTextLanguage } from '../../i18n/detectLanguage';
import { downloadRemoteUrl } from '../../services/assistantApi';
import { buildClientZipBlob } from '../platform/clientZip';
import {
  writeComputerBinaryFile,
  writeComputerFile,
  type ComputerFolderMount,
} from '../platform/computerFiles';
import { collectSystemMetrics } from '../platform/systemMetrics';
import type {
  ActivityLogEntry,
  AppLanguage,
  AuthorizedAppLink,
  BudgetTarget,
  CachedEmailPreview,
  ClipboardEntry,
  DailyEmailSummary,
  DataTableSchema,
  DownloadRecord,
  FinanceCurrency,
  FinanceEntryType,
  FinancialEntry,
  ReminderItem,
  ReminderRecurrence,
  ScheduledEventAction,
  WorkspaceSnapshot,
} from '../../types/assistant';

const EXTENDED_STORE_KEY = 'neuron_mind_extended_workspace_v1';

interface ExtendedStoreData {
  reminders: ReminderItem[];
  financialEntries: FinancialEntry[];
  budgetTargets: BudgetTarget[];
  dataTables: DataTableSchema[];
  clipboardHistory: ClipboardEntry[];
  downloads: DownloadRecord[];
  activityLogs: ActivityLogEntry[];
  authorizedApps: AuthorizedAppLink[];
  scheduledEventActions: ScheduledEventAction[];
  cachedEmails: CachedEmailPreview[];
  dailyEmailSummaries: DailyEmailSummary[];
}

export const DEFAULT_APPS: AuthorizedAppLink[] = [
  // Desktop & System Apps
  { id: 'app-vscode', name: 'Visual Studio Code', uri: 'vscode://file', category: 'app' },
  { id: 'app-win-settings', name: 'Windows Settings', uri: 'ms-settings:', category: 'app' },
  { id: 'app-calculator', name: 'Windows Calculator', uri: 'calculator:', category: 'app' },
  { id: 'app-clock', name: 'Windows Clock & Alarms', uri: 'ms-clock:', category: 'app' },
  { id: 'app-mail', name: 'Default Mail Client', uri: 'mailto:', category: 'app' },
  { id: 'app-store', name: 'Microsoft Store', uri: 'ms-windows-store:', category: 'app' },
  { id: 'app-spotify', name: 'Spotify Desktop', uri: 'spotify:', category: 'app' },
  { id: 'app-discord', name: 'Discord', uri: 'discord:', category: 'app' },
  { id: 'app-telegram', name: 'Telegram Desktop', uri: 'tg://', category: 'app' },
  { id: 'app-whatsapp', name: 'WhatsApp Desktop', uri: 'whatsapp:', category: 'app' },
  { id: 'app-notion', name: 'Notion', uri: 'notion://', category: 'app' },
  { id: 'app-obsidian', name: 'Obsidian Notes', uri: 'obsidian://', category: 'app' },
  // Web Workspaces & Productivity Sites
  { id: 'web-gmail', name: 'Gmail Web', uri: 'https://mail.google.com', category: 'web' },
  { id: 'web-calendar', name: 'Google Calendar', uri: 'https://calendar.google.com', category: 'web' },
  { id: 'web-drive', name: 'Google Drive', uri: 'https://drive.google.com', category: 'web' },
  { id: 'web-github', name: 'GitHub', uri: 'https://github.com', category: 'web' },
  { id: 'web-youtube', name: 'YouTube', uri: 'https://www.youtube.com', category: 'web' },
  { id: 'web-figma', name: 'Figma', uri: 'https://www.figma.com', category: 'web' },
];

const DEFAULT_EXTENDED: ExtendedStoreData = {
  reminders: [],
  financialEntries: [],
  budgetTargets: [],
  dataTables: [],
  clipboardHistory: [],
  downloads: [],
  activityLogs: [],
  authorizedApps: DEFAULT_APPS,
  scheduledEventActions: [],
  cachedEmails: [],
  dailyEmailSummaries: [],
};

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mergeBuiltInApps(existing: AuthorizedAppLink[]): AuthorizedAppLink[] {
  const legacyOnly =
    existing.length <= 3 &&
    existing.every((a) => ['app-vscode', 'app-win-settings', 'app-mail'].includes(a.id));
  if (!legacyOnly) return existing;
  const existingUris = new Set(existing.map((a) => a.uri));
  return [...existing, ...DEFAULT_APPS.filter((d) => !existingUris.has(d.uri))];
}

function loadExtended(): ExtendedStoreData {
  if (typeof window === 'undefined') return DEFAULT_EXTENDED;
  try {
    const raw = window.localStorage.getItem(EXTENDED_STORE_KEY);
    if (!raw) return DEFAULT_EXTENDED;
    const parsed = JSON.parse(raw) as Partial<ExtendedStoreData>;
    return {
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      financialEntries: Array.isArray(parsed.financialEntries) ? parsed.financialEntries : [],
      budgetTargets: Array.isArray(parsed.budgetTargets) ? parsed.budgetTargets : [],
      dataTables: Array.isArray(parsed.dataTables) ? parsed.dataTables : [],
      clipboardHistory: Array.isArray(parsed.clipboardHistory) ? parsed.clipboardHistory : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
      activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
      authorizedApps:
        Array.isArray(parsed.authorizedApps) && parsed.authorizedApps.length > 0
          ? mergeBuiltInApps(parsed.authorizedApps)
          : DEFAULT_APPS,
      scheduledEventActions: Array.isArray(parsed.scheduledEventActions)
        ? parsed.scheduledEventActions
        : [],
      cachedEmails: Array.isArray(parsed.cachedEmails)
        ? parsed.cachedEmails.slice(0, 25)
        : [],
      dailyEmailSummaries: Array.isArray(parsed.dailyEmailSummaries)
        ? parsed.dailyEmailSummaries.slice(0, 30)
        : [],
    };
  } catch {
    return DEFAULT_EXTENDED;
  }
}

function saveExtended(data: ExtendedStoreData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXTENDED_STORE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota error
  }
}

export function useExtendedWorkspaceStore() {
  const [data, setData] = useState<ExtendedStoreData>(() => loadExtended());
  const dataRef = useRef(data);
  dataRef.current = data;

  const update = useCallback((updater: (prev: ExtendedStoreData) => ExtendedStoreData) => {
    setData((prev) => {
      const next = updater(prev);
      saveExtended(next);
      return next;
    });
  }, []);

  const logActivity = useCallback(
    (entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>) => {
      const logItem: ActivityLogEntry = {
        ...entry,
        id: makeId(),
        createdAt: new Date().toISOString(),
      };
      update((prev) => ({
        ...prev,
        activityLogs: [logItem, ...prev.activityLogs].slice(0, 200),
      }));
      return logItem;
    },
    [update]
  );

  // Reminders
  const createReminder = useCallback(
    (input: {
      title: string;
      dueAt: string;
      recurrence?: ReminderRecurrence;
      sourceLanguage?: AppLanguage;
    }) => {
      const now = new Date().toISOString();
      const item: ReminderItem = {
        id: makeId(),
        title: input.title.trim(),
        dueAt: input.dueAt,
        recurrence: input.recurrence ?? 'none',
        completed: false,
        sourceLanguage: input.sourceLanguage ?? detectTextLanguage(input.title),
        createdAt: now,
        updatedAt: now,
      };
      update((prev) => ({ ...prev, reminders: [item, ...prev.reminders] }));
      logActivity({
        category: 'automation',
        title: `Reminder set: ${item.title}`,
        details: item.dueAt,
        status: 'success',
      });
      return item;
    },
    [update, logActivity]
  );

  const upsertReminder = useCallback(
    (item: ReminderItem) => {
      update((prev) => ({
        ...prev,
        reminders: [item, ...prev.reminders.filter((r) => r.id !== item.id)],
      }));
    },
    [update]
  );

  const completeReminder = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      update((prev) => ({
        ...prev,
        reminders: prev.reminders.map((r) =>
          r.id === id ? { ...r, completed: !r.completed, updatedAt: now } : r
        ),
      }));
    },
    [update]
  );

  const deleteReminder = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        reminders: prev.reminders.filter((r) => r.id !== id),
      }));
    },
    [update]
  );

  const markReminderNotified = useCallback(
    (id: string, nextDueAt?: string) => {
      const now = new Date().toISOString();
      update((prev) => ({
        ...prev,
        reminders: prev.reminders.map((r) => {
          if (r.id !== id) return r;
          if (nextDueAt) {
            return { ...r, dueAt: nextDueAt, notifiedAt: now, updatedAt: now };
          }
          return { ...r, notifiedAt: now, updatedAt: now };
        }),
      }));
    },
    [update]
  );

  // Finance
  const addFinancialEntry = useCallback(
    (input: {
      type: FinanceEntryType;
      amount: number;
      currency: FinanceCurrency;
      category: string;
      note: string;
      date: string;
      sourceLanguage?: AppLanguage;
    }) => {
      const item: FinancialEntry = {
        id: makeId(),
        type: input.type,
        amount: Math.abs(Number(input.amount) || 0),
        currency: input.currency,
        category: input.category.trim() || 'General',
        note: input.note.trim(),
        date: input.date || new Date().toISOString().slice(0, 10),
        sourceLanguage: input.sourceLanguage ?? detectTextLanguage(input.category + ' ' + input.note),
        createdAt: new Date().toISOString(),
      };
      update((prev) => ({
        ...prev,
        financialEntries: [item, ...prev.financialEntries],
      }));
      logActivity({
        category: 'finance',
        title: `${item.type === 'income' ? '+' : '-'}${item.amount} ${item.currency} (${item.category})`,
        details: item.note,
        status: 'success',
      });
      return item;
    },
    [update, logActivity]
  );

  const upsertFinancialEntry = useCallback(
    (item: FinancialEntry) => {
      update((prev) => ({
        ...prev,
        financialEntries: [item, ...prev.financialEntries.filter((f) => f.id !== item.id)],
      }));
    },
    [update]
  );

  const deleteFinancialEntry = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        financialEntries: prev.financialEntries.filter((f) => f.id !== id),
      }));
    },
    [update]
  );

  const setBudgetTarget = useCallback(
    (target: BudgetTarget) => {
      update((prev) => ({
        ...prev,
        budgetTargets: [
          target,
          ...prev.budgetTargets.filter(
            (b) =>
              !(
                b.category.toLowerCase() === target.category.toLowerCase() &&
                b.currency === target.currency
              )
          ),
        ],
      }));
    },
    [update]
  );

  const deleteBudgetTarget = useCallback(
    (category: string, currency: FinanceCurrency) => {
      update((prev) => ({
        ...prev,
        budgetTargets: prev.budgetTargets.filter(
          (b) =>
            !(
              b.category.toLowerCase() === category.toLowerCase() &&
              b.currency === currency
            )
        ),
      }));
    },
    [update]
  );

  // Calendar Scheduled Event Actions
  const setEventScheduledAction = useCallback(
    (action: ScheduledEventAction) => {
      update((prev) => ({
        ...prev,
        scheduledEventActions: [
          action,
          ...prev.scheduledEventActions.filter((a) => a.eventId !== action.eventId),
        ],
      }));
    },
    [update]
  );

  const updateEventScheduledActionState = useCallback(
    (
      eventId: string,
      patch: Partial<Pick<ScheduledEventAction, 'notifiedAt' | 'actionStatus' | 'actionResult'>>
    ) => {
      update((prev) => ({
        ...prev,
        scheduledEventActions: prev.scheduledEventActions.map((a) =>
          a.eventId === eventId ? { ...a, ...patch } : a
        ),
      }));
    },
    [update]
  );

  const removeEventScheduledAction = useCallback(
    (eventId: string) => {
      update((prev) => ({
        ...prev,
        scheduledEventActions: prev.scheduledEventActions.filter((a) => a.eventId !== eventId),
      }));
    },
    [update]
  );

  // Cached Emails & Daily 8 PM Summaries
  const setCachedEmails = useCallback(
    (emails: CachedEmailPreview[]) => {
      update((prev) => ({
        ...prev,
        cachedEmails: emails.slice(0, 25),
      }));
    },
    [update]
  );

  const upsertDailyEmailSummary = useCallback(
    (summary: DailyEmailSummary) => {
      update((prev) => ({
        ...prev,
        dailyEmailSummaries: [
          summary,
          ...prev.dailyEmailSummaries.filter((s) => s.dateKey !== summary.dateKey),
        ].slice(0, 30),
      }));
      logActivity({
        category: 'agent',
        title: `Daily email summary generated (${summary.dateKey})`,
        details: `${summary.importantEmails.length} important / ${summary.totalScanned} scanned`,
        status: 'success',
      });
    },
    [update, logActivity]
  );

  const clearCachedMailbox = useCallback(() => {
    update((prev) => ({
      ...prev,
      cachedEmails: [],
    }));
  }, [update]);

  // Data Tables
  const createDataTable = useCallback(
    (name: string, columns: string[]) => {
      const now = new Date().toISOString();
      const table: DataTableSchema = {
        id: makeId(),
        name: name.trim() || 'Untitled Table',
        columns: columns.map((c) => c.trim()).filter(Boolean),
        rows: [],
        createdAt: now,
        updatedAt: now,
      };
      update((prev) => ({ ...prev, dataTables: [table, ...prev.dataTables] }));
      logActivity({
        category: 'system',
        title: `Database table created: ${table.name}`,
        details: table.columns.join(', '),
        status: 'success',
      });
      return table;
    },
    [update, logActivity]
  );

  const upsertDataTable = useCallback(
    (table: DataTableSchema) => {
      update((prev) => ({
        ...prev,
        dataTables: [table, ...prev.dataTables.filter((t) => t.id !== table.id)],
      }));
    },
    [update]
  );

  const insertTableRow = useCallback(
    (tableId: string, row: Record<string, string>) => {
      const now = new Date().toISOString();
      update((prev) => ({
        ...prev,
        dataTables: prev.dataTables.map((t) =>
          t.id === tableId
            ? { ...t, rows: [row, ...t.rows], updatedAt: now }
            : t
        ),
      }));
    },
    [update]
  );

  const deleteTableRow = useCallback(
    (tableId: string, rowIdx: number) => {
      const now = new Date().toISOString();
      update((prev) => ({
        ...prev,
        dataTables: prev.dataTables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                rows: t.rows.filter((_, idx) => idx !== rowIdx),
                updatedAt: now,
              }
            : t
        ),
      }));
    },
    [update]
  );

  const deleteDataTable = useCallback(
    (tableId: string) => {
      update((prev) => ({
        ...prev,
        dataTables: prev.dataTables.filter((t) => t.id !== tableId),
      }));
    },
    [update]
  );

  // Clipboard Manager
  const saveClipboardEntry = useCallback(
    (text: string, label?: string) => {
      const clean = text.trim();
      if (!clean) return null;
      const item: ClipboardEntry = {
        id: makeId(),
        text: clean,
        label: label?.trim() || undefined,
        pinned: false,
        createdAt: new Date().toISOString(),
      };
      update((prev) => ({
        ...prev,
        clipboardHistory: [item, ...prev.clipboardHistory.filter((c) => c.text !== clean)].slice(0, 100),
      }));
      return item;
    },
    [update]
  );

  const togglePinClipboard = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        clipboardHistory: prev.clipboardHistory.map((c) =>
          c.id === id ? { ...c, pinned: !c.pinned } : c
        ),
      }));
    },
    [update]
  );

  const deleteClipboardEntry = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        clipboardHistory: prev.clipboardHistory.filter((c) => c.id !== id),
      }));
    },
    [update]
  );

  // Downloads Manager
  const addDownloadRecord = useCallback(
    (record: Omit<DownloadRecord, 'id' | 'createdAt'>) => {
      const item: DownloadRecord = {
        ...record,
        id: makeId(),
        createdAt: new Date().toISOString(),
      };
      update((prev) => ({ ...prev, downloads: [item, ...prev.downloads].slice(0, 100) }));
      logActivity({
        category: 'research',
        title: `Downloaded: ${item.filename}`,
        details: `${item.sizeBytes} bytes · ${item.url}`,
        status: 'success',
      });
      return item;
    },
    [update, logActivity]
  );

  // Authorized Apps
  const addAuthorizedApp = useCallback(
    (app: Omit<AuthorizedAppLink, 'id'>) => {
      const item: AuthorizedAppLink = { ...app, id: makeId() };
      update((prev) => ({ ...prev, authorizedApps: [item, ...prev.authorizedApps] }));
      return item;
    },
    [update]
  );

  const removeAuthorizedApp = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        authorizedApps: prev.authorizedApps.filter((a) => a.id !== id),
      }));
    },
    [update]
  );

  const restoreRecommendedApps = useCallback(() => {
    update((prev) => {
      const existingUris = new Set(prev.authorizedApps.map((a) => a.uri.toLowerCase()));
      const missing = DEFAULT_APPS.filter((d) => !existingUris.has(d.uri.toLowerCase()));
      return {
        ...prev,
        authorizedApps: [...prev.authorizedApps, ...missing],
      };
    });
  }, [update]);

  // Backup Manager
  const createVerifiedBackup = useCallback(
    async (
      coreSnapshot: WorkspaceSnapshot,
      mounts: ComputerFolderMount[],
      targetSubfolder = 'Backups',
      format: 'json' | 'zip' = 'json'
    ): Promise<{ filename: string; savedToPcPath?: string; checksumHex: string }> => {
      const createdAt = new Date().toISOString();
      const payload = {
        app: 'Neuron Mind',
        version: 1,
        createdAt,
        workspace: {
          ...coreSnapshot,
          reminders: dataRef.current.reminders,
          financialEntries: dataRef.current.financialEntries,
          dataTables: dataRef.current.dataTables,
          clipboardHistory: dataRef.current.clipboardHistory,
        },
      };

      const jsonText = JSON.stringify(payload, null, 2);
      let checksumHex = 'sha256-unavailable';
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(jsonText)
        );
        checksumHex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 16);
      }

      const dateTag = createdAt.slice(0, 10);
      const granted = mounts.filter((m) => m.permission === 'granted');
      let savedToPcPath: string | undefined;

      if (format === 'json' && granted.length > 0) {
        const filePath = `${granted[0].name}/${targetSubfolder}/neuron-mind-backup-${dateTag}.json`;
        const res = await writeComputerFile(mounts, filePath, jsonText, 'overwrite');
        savedToPcPath = res.path;
      }

      const blob =
        format === 'zip'
          ? buildClientZipBlob([
              { name: 'workspace-backup.json', content: jsonText },
              {
                name: 'BACKUP_MANIFEST.txt',
                content: `Neuron Mind Backup\nCreated: ${createdAt}\nChecksum (SHA-256 prefix): ${checksumHex}\nTasks: ${coreSnapshot.tasks.length}\nEvents: ${coreSnapshot.events.length}\nDocuments: ${coreSnapshot.documents.length}\nMemories: ${coreSnapshot.memories.length}\nReminders: ${dataRef.current.reminders.length}\nTransactions: ${dataRef.current.financialEntries.length}\nTables: ${dataRef.current.dataTables.length}\n`,
              },
            ])
          : new Blob([jsonText], { type: 'application/json;charset=utf-8' });

      const filename =
        format === 'zip'
          ? `neuron-mind-backup-${dateTag}.zip`
          : `neuron-mind-backup-${dateTag}.json`;

      if (!savedToPcPath) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }

      logActivity({
        category: 'files',
        title: `Backup created (${filename})`,
        details: savedToPcPath ? `Saved to ${savedToPcPath}` : `Downloaded · SHA256:${checksumHex}`,
        status: 'success',
      });

      return { filename, savedToPcPath, checksumHex };
    },
    [logActivity]
  );

  // Unified client tool executor for extended non-FS tools
  const executeExtendedClientTool = useCallback(
    async (
      toolName: string,
      args: Record<string, unknown>,
      coreSnapshot: WorkspaceSnapshot,
      mounts: ComputerFolderMount[]
    ): Promise<Record<string, unknown> | null> => {
      switch (toolName) {
        case 'get_system_metrics': {
          const metrics = await collectSystemMetrics();
          return { success: true, ...metrics };
        }

        case 'list_clipboard_history': {
          const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
          const items = dataRef.current.clipboardHistory.filter((c) =>
            !q
              ? true
              : c.text.toLowerCase().includes(q) ||
                (c.label ?? '').toLowerCase().includes(q)
          );
          return { success: true, count: items.length, entries: items.slice(0, 30) };
        }

        case 'save_clipboard_entry': {
          const text = String(args.text ?? '');
          const label = typeof args.label === 'string' ? args.label : undefined;
          const entry = saveClipboardEntry(text, label);
          let copiedToSystem = false;
          if (args.copyToSystemClipboard && navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              copiedToSystem = true;
            } catch {
              copiedToSystem = false;
            }
          }
          return { success: Boolean(entry), entry, copiedToSystem };
        }

        case 'copy_to_clipboard': {
          const text = String(args.text ?? '');
          const entry = saveClipboardEntry(text);
          let copiedToSystem = false;
          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              copiedToSystem = true;
            } catch {
              copiedToSystem = false;
            }
          }
          return {
            success: Boolean(entry),
            copiedToSystem,
            note: copiedToSystem
              ? 'Copied to system clipboard and saved in Clipboard History.'
              : 'Saved in Neuron Mind Clipboard History (browser clipboard write requires active page focus).',
          };
        }

        case 'create_workspace_backup': {
          const folder = typeof args.targetFolder === 'string' ? args.targetFolder : 'Backups';
          const res = await createVerifiedBackup(coreSnapshot, mounts, folder, 'json');
          return { success: true, ...res };
        }

        case 'download_from_url': {
          const url = String(args.url ?? '').trim();
          const saveFolderPath =
            typeof args.saveFolderPath === 'string' ? args.saveFolderPath.trim() : 'Downloads';
          let payload: Awaited<ReturnType<typeof downloadRemoteUrl>>;
          try {
            payload = await downloadRemoteUrl(url);
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : 'Download failed.',
            };
          }

          const granted = mounts.filter((m) => m.permission === 'granted');
          let savedLocation: 'computer_folder' | 'browser_download' = 'browser_download';
          let savedPath = payload.filename;

          if (granted.length > 0) {
            const rawBytes = new Uint8Array(await payload.blob.arrayBuffer());
            const target = `${granted[0].name}/${saveFolderPath}/${payload.filename}`;
            const writeRes = await writeComputerBinaryFile(mounts, target, rawBytes);
            savedLocation = 'computer_folder';
            savedPath = writeRes.path;
          } else {
            const blobUrl = URL.createObjectURL(payload.blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = payload.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
          }

          addDownloadRecord({
            url: payload.url,
            filename: payload.filename,
            mimeType: payload.mimeType,
            sizeBytes: payload.sizeBytes,
            savedLocation,
          });

          return {
            success: true,
            filename: payload.filename,
            sizeBytes: payload.sizeBytes,
            savedLocation,
            savedPath,
          };
        }

        case 'launch_authorized_app_or_url': {
          const uri = String(args.uri ?? '').trim();
          const label = String(args.label ?? uri);
          const allowed =
            /^(https?:|mailto:|tel:|vscode:|ms-settings:|calculator:|ms-clock:|ms-windows-store:|spotify:|discord:|tg:|whatsapp:|notion:|obsidian:)/i.test(
              uri
            );
          if (!allowed) {
            return {
              success: false,
              error:
                'Only permitted web/protocol URIs (https://, mailto:, tel:, vscode:, ms-settings:, calculator:, spotify:, discord:, tg:, whatsapp:, notion:, obsidian:) are allowed.',
            };
          }
          addAuthorizedApp({
            name: label,
            uri,
            category: uri.startsWith('http') ? 'web' : 'app',
          });
          logActivity({
            category: 'security',
            title: `Authorized launcher prepared: ${label}`,
            details: uri,
            status: 'success',
          });
          return {
            success: true,
            preparedUri: uri,
            label,
            note: 'Added to Authorized Apps & Links in Research & Web so the user can launch it with one click (browser blocks unprompted popups without a direct user click).',
          };
        }

        default:
          return null;
      }
    },
    [
      saveClipboardEntry,
      createVerifiedBackup,
      addDownloadRecord,
      addAuthorizedApp,
      logActivity,
    ]
  );

  useEffect(() => {
    saveExtended(data);
  }, [data]);

  return {
    reminders: data.reminders,
    financialEntries: data.financialEntries,
    budgetTargets: data.budgetTargets,
    dataTables: data.dataTables,
    clipboardHistory: data.clipboardHistory,
    downloads: data.downloads,
    activityLogs: data.activityLogs,
    authorizedApps: data.authorizedApps,
    scheduledEventActions: data.scheduledEventActions,
    cachedEmails: data.cachedEmails,
    dailyEmailSummaries: data.dailyEmailSummaries,
    logActivity,
    createReminder,
    upsertReminder,
    completeReminder,
    deleteReminder,
    markReminderNotified,
    addFinancialEntry,
    upsertFinancialEntry,
    deleteFinancialEntry,
    setBudgetTarget,
    deleteBudgetTarget,
    setEventScheduledAction,
    updateEventScheduledActionState,
    removeEventScheduledAction,
    setCachedEmails,
    upsertDailyEmailSummary,
    clearCachedMailbox,
    createDataTable,
    upsertDataTable,
    insertTableRow,
    deleteTableRow,
    deleteDataTable,
    saveClipboardEntry,
    togglePinClipboard,
    deleteClipboardEntry,
    addDownloadRecord,
    addAuthorizedApp,
    removeAuthorizedApp,
    restoreRecommendedApps,
    createVerifiedBackup,
    executeExtendedClientTool,
  };
}
