import {
  Bot,
  CheckSquare,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus,
  Info,
  Loader2,
  Lock,
  Mic,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { formatMicError } from '../../hooks/useVoiceInput';
import { useLanguage } from '../../i18n/languageContext';
import {
  clearEncryptedVault,
  hasInitializedVault,
  saveEncryptedVault,
  unlockEncryptedVault,
  type VaultSecretEntry,
} from '../../lib/security/cryptoVault';
import { transcribeMeetingAudio } from '../../services/assistantApi';
import type {
  ActivityLogEntry,
  BudgetTarget,
  FinanceCurrency,
  FinanceEntryType,
  FinancialEntry,
  TaskPriority,
} from '../../types/assistant';

interface HubViewProps {
  isOnline: boolean;
  onCreateTask: (input: { title: string; priority: TaskPriority }) => Promise<unknown>;
  onCreateDocument: (input: {
    title: string;
    content: string;
    folder: string;
  }) => Promise<unknown>;
  financialEntries: FinancialEntry[];
  onAddFinancialEntry: (input: {
    type: FinanceEntryType;
    amount: number;
    currency: FinanceCurrency;
    category: string;
    note: string;
    date: string;
  }) => unknown;
  onDeleteFinancialEntry: (id: string) => void;
  budgetTargets: BudgetTarget[];
  onSetBudgetTarget: (target: BudgetTarget) => void;
  onDeleteBudgetTarget?: (category: string, currency: FinanceCurrency) => void;
  onDraftInAssistant: (prompt: string) => void;
  activityLogs: ActivityLogEntry[];
  onVaultLockChange: (unlocked: boolean) => void;
  onLogActivity: (entry: {
    category: 'agent' | 'security' | 'finance';
    title: string;
    details?: string;
    status: 'success' | 'warning' | 'error';
  }) => void;
}

type HubTab = 'meetings' | 'finance' | 'vault' | 'activity';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = typeof reader.result === 'string' ? reader.result : '';
      const idx = str.indexOf(',');
      resolve(idx !== -1 ? str.slice(idx + 1) : str);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Read failed.'));
    reader.readAsDataURL(blob);
  });
}

export function HubView({
  isOnline,
  onCreateTask,
  onCreateDocument,
  financialEntries,
  onAddFinancialEntry,
  onDeleteFinancialEntry,
  budgetTargets,
  onSetBudgetTarget,
  onDeleteBudgetTarget,
  onDraftInAssistant,
  activityLogs,
  onVaultLockChange,
  onLogActivity,
}: HubViewProps) {
  const { language, t, formatDateTime, formatNumber } = useLanguage();
  const [activeTab, setActiveTab] = useState<HubTab>('meetings');

  // Meetings Audio state
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingNotice, setMeetingNotice] = useState<string | null>(null);
  const [meetingResult, setMeetingResult] = useState<{
    transcript: string;
    summary: string;
    decisions: string[];
    actionItems: Array<{ title: string; owner?: string; priority: TaskPriority }>;
  } | null>(null);

  // Finance state
  const [finType, setFinType] = useState<FinanceEntryType>('expense');
  const [finAmount, setFinAmount] = useState('');
  const [finCurrency, setFinCurrency] = useState<FinanceCurrency>('USD');
  const [finCategory, setFinCategory] = useState('');
  const [finNote, setFinNote] = useState('');
  const [finDate, setFinDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [finFilter, setFinFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [budgetCat, setBudgetCat] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetCur, setBudgetCur] = useState<FinanceCurrency>('USD');

  // Credential Vault state (passphrase & secrets stay in memory only)
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [sessionPassphrase, setSessionPassphrase] = useState<string | null>(null);
  const [vaultEntries, setVaultEntries] = useState<VaultSecretEntry[]>([]);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultLabel, setVaultLabel] = useState('');
  const [vaultUsername, setVaultUsername] = useState('');
  const [vaultSecret, setVaultSecret] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  const [confirmVaultReset, setConfirmVaultReset] = useState(false);

  // Activity Log state
  const [activitySearch, setActivitySearch] = useState('');

  const processAudioBlob = async (blob: Blob) => {
    setMeetingError(null);
    setMeetingNotice(null);
    setTranscribing(true);
    try {
      const base64 = await blobToBase64(blob);
      const res = await transcribeMeetingAudio(
        base64,
        blob.type || 'audio/webm',
        language
      );
      setMeetingResult(res);
      onLogActivity({
        category: 'agent',
        title: 'Meeting audio transcribed',
        details: `${res.actionItems.length} action items extracted`,
        status: 'success',
      });
    } catch (err) {
      setMeetingError(
        err instanceof Error ? err.message : 'Unable to transcribe meeting audio.'
      );
    } finally {
      setTranscribing(false);
    }
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setMeetingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void processAudioBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const msg = await formatMicError(err, language);
      setMeetingError(msg);
    }
  };

  const handleAudioUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processAudioBlob(file);
  };

  const handleConvertMeetingActions = async () => {
    if (!meetingResult || meetingResult.actionItems.length === 0) return;
    for (const item of meetingResult.actionItems) {
      await onCreateTask({
        title: item.owner ? `${item.title} (${item.owner})` : item.title,
        priority: item.priority,
      });
    }
    setMeetingNotice(`${meetingResult.actionItems.length} tasks added.`);
  };

  const handleSaveMeetingDoc = async () => {
    if (!meetingResult) return;
    const body = [
      `## Summary\n${meetingResult.summary}`,
      meetingResult.decisions.length > 0
        ? `## Decisions\n${meetingResult.decisions.map((d) => `- ${d}`).join('\n')}`
        : '',
      meetingResult.actionItems.length > 0
        ? `## Action Items\n${meetingResult.actionItems
            .map((a) => `- [${a.priority}] ${a.title}${a.owner ? ` (${a.owner})` : ''}`)
            .join('\n')}`
        : '',
      `## Transcript\n${meetingResult.transcript}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    await onCreateDocument({
      title: `Meeting Notes ${new Date().toISOString().slice(0, 10)}`,
      folder: 'Meetings',
      content: body,
    });
    setMeetingNotice('Saved to Files.');
  };

  // Finance helpers
  const filteredFinance = financialEntries.filter((f) =>
    finFilter === 'all' ? true : f.type === finFilter
  );

  const totalsByCurrency = (['USD', 'IRR', 'EUR'] as const)
    .map((cur) => {
      const items = financialEntries.filter((f) => f.currency === cur);
      const income = items
        .filter((f) => f.type === 'income')
        .reduce((sum, f) => sum + f.amount, 0);
      const expense = items
        .filter((f) => f.type === 'expense')
        .reduce((sum, f) => sum + f.amount, 0);
      return { currency: cur, income, expense, net: income - expense, count: items.length };
    })
    .filter((row) => row.count > 0 || row.currency === finCurrency);

  const handleAddFinance = (e: FormEvent) => {
    e.preventDefault();
    const numeric = Number(finAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    onAddFinancialEntry({
      type: finType,
      amount: numeric,
      currency: finCurrency,
      category: finCategory.trim() || 'General',
      note: finNote.trim(),
      date: finDate || new Date().toISOString().slice(0, 10),
    });
    setFinAmount('');
    setFinCategory('');
    setFinNote('');
  };

  const handleSetBudget = (e: FormEvent) => {
    e.preventDefault();
    const numeric = Number(budgetLimit);
    if (!budgetCat.trim() || !Number.isFinite(numeric) || numeric <= 0) return;
    onSetBudgetTarget({
      category: budgetCat.trim(),
      monthlyLimit: numeric,
      currency: budgetCur,
    });
    setBudgetCat('');
    setBudgetLimit('');
  };

  const expenseBreakdown = (() => {
    const map = new Map<string, { category: string; currency: FinanceCurrency; total: number }>();
    for (const item of financialEntries) {
      if (item.type !== 'expense') continue;
      const key = `${item.category.toLowerCase()}::${item.currency}`;
      const prev = map.get(key);
      if (prev) prev.total += item.amount;
      else map.set(key, { category: item.category, currency: item.currency, total: item.amount });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();

  const handleExportFinanceCsv = () => {
    const rows = [
      'Date,Type,Amount,Currency,Category,Note',
      ...financialEntries.map((f) =>
        [f.date, f.type, String(f.amount), f.currency, f.category, f.note]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuron-mind-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Vault handlers
  const vaultInitialized = hasInitializedVault();

  const handleUnlockVault = async (e: FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    setVaultNotice(null);
    try {
      if (!vaultInitialized) {
        await saveEncryptedVault(vaultPassphrase, []);
        setSessionPassphrase(vaultPassphrase);
        setVaultEntries([]);
        setVaultPassphrase('');
        onVaultLockChange(true);
        onLogActivity({
          category: 'security',
          title: 'Credential Vault initialized & unlocked',
          status: 'success',
        });
      } else {
        const entries = await unlockEncryptedVault(vaultPassphrase);
        setSessionPassphrase(vaultPassphrase);
        setVaultEntries(entries);
        setVaultPassphrase('');
        onVaultLockChange(true);
        onLogActivity({
          category: 'security',
          title: 'Credential Vault unlocked',
          status: 'success',
        });
      }
    } catch (err) {
      setVaultError(
        err instanceof Error
          ? err.message
          : 'Incorrect passphrase or vault decryption failed.'
      );
      onLogActivity({
        category: 'security',
        title: 'Credential Vault unlock failed',
        status: 'warning',
      });
    }
  };

  const handleAddVaultSecret = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionPassphrase || !vaultLabel.trim() || !vaultSecret.trim()) return;
    setVaultError(null);
    try {
      const nextEntry: VaultSecretEntry = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `v-${Date.now()}`,
        label: vaultLabel.trim(),
        username: vaultUsername.trim(),
        secret: vaultSecret.trim(),
        updatedAt: new Date().toISOString(),
      };
      const nextList = [nextEntry, ...vaultEntries];
      await saveEncryptedVault(sessionPassphrase, nextList);
      setVaultEntries(nextList);
      setVaultLabel('');
      setVaultUsername('');
      setVaultSecret('');
      onLogActivity({
        category: 'security',
        title: `Encrypted secret stored (${nextEntry.label})`,
        status: 'success',
      });
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : 'Encryption failed.');
    }
  };

  const handleDeleteVaultSecret = async (id: string) => {
    if (!sessionPassphrase) return;
    const nextList = vaultEntries.filter((v) => v.id !== id);
    await saveEncryptedVault(sessionPassphrase, nextList);
    setVaultEntries(nextList);
  };

  const handleLockVault = () => {
    setSessionPassphrase(null);
    setVaultEntries([]);
    setRevealedIds({});
    onVaultLockChange(false);
    onLogActivity({
      category: 'security',
      title: 'Credential Vault locked',
      status: 'success',
    });
  };

  const handleResetVault = () => {
    clearEncryptedVault();
    setSessionPassphrase(null);
    setVaultEntries([]);
    setConfirmVaultReset(false);
    onVaultLockChange(false);
    onLogActivity({
      category: 'security',
      title: 'Credential Vault wiped & reset',
      status: 'warning',
    });
  };

  const filteredActivity = activityLogs.filter((entry) => {
    const q = activitySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.title.toLowerCase().includes(q) ||
      (entry.details ?? '').toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q)
    );
  });

  const tabs: Array<{ id: HubTab; label: string }> = [
    { id: 'meetings', label: t.hub.tabMeetings },
    { id: 'finance', label: t.hub.tabFinance },
    { id: 'vault', label: t.hub.tabVault },
    { id: 'activity', label: t.hub.tabActivity },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="space-y-2">
          <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.hub.kicker}</p>
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
            {t.hub.title}
          </h2>
          <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {t.hub.subtitle}
          </p>
        </section>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#132852] border border-blue-900/10 dark:border-blue-400/20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'meetings' ? (
          <section className="space-y-5">
            <div className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!isOnline || transcribing}
                onClick={() => void handleToggleRecord()}
                className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isRecording
                    ? 'bg-red-700 hover:bg-red-800 text-white'
                    : 'bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500'
                }`}
              >
                {isRecording ? (
                  <Square className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {isRecording ? t.hub.recordMeetingStop : t.hub.recordMeetingStart}
                </span>
              </button>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => void handleAudioUpload(e)}
                className="sr-only"
              />
              <button
                type="button"
                disabled={!isOnline || transcribing || isRecording}
                onClick={() => audioInputRef.current?.click()}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#132852] hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200 disabled:opacity-40"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{t.hub.uploadAudioButton}</span>
              </button>

              {transcribing ? (
                <div className="inline-flex items-center gap-2 text-xs text-[#102A5C] dark:text-blue-300">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{t.hub.transcribingLabel}</span>
                </div>
              ) : null}
            </div>

            {meetingError ? (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-800 dark:text-red-200">
                {meetingError}
              </div>
            ) : null}

            {meetingNotice ? (
              <div className="p-3 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA] dark:bg-[#132852] text-xs font-medium text-[#102A5C] dark:text-blue-200">
                {meetingNotice}
              </div>
            ) : null}

            {meetingResult ? (
              <div className="space-y-4">
                <article className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                      {t.hub.actionItemsTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {meetingResult.actionItems.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleConvertMeetingActions()}
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500"
                        >
                          <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.hub.convertActionsToTasks}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleSaveMeetingDoc()}
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-blue-900/20 dark:border-blue-400/25 text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                      >
                        <FilePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.hub.saveMeetingDoc}</span>
                      </button>
                    </div>
                  </div>
                  <p dir="auto" className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {meetingResult.summary}
                  </p>
                  {meetingResult.decisions.length > 0 ? (
                    <div className="space-y-1.5 pt-2 border-t border-blue-950/10 dark:border-blue-400/15">
                      <h4 className="text-xs font-semibold text-[#102A5C] dark:text-blue-300">
                        {t.hub.decisionsTitle}
                      </h4>
                      <ul className="list-disc list-inside text-xs text-slate-700 dark:text-slate-200 space-y-1">
                        {meetingResult.decisions.map((d, i) => (
                          <li key={i} dir="auto">
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {meetingResult.actionItems.length > 0 ? (
                    <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/10 dark:border-blue-400/20 rounded-lg">
                      {meetingResult.actionItems.map((item, i) => (
                        <li key={i} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                          <span dir="auto" className="text-[#0B1B3B] dark:text-slate-100 font-medium">
                            {item.title}
                            {item.owner ? ` (${item.owner})` : ''}
                          </span>
                          <span className="font-mono text-[#1E3A8A] dark:text-blue-300 uppercase">
                            {item.priority}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>

                <article className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-2">
                  <h3 className="text-xs font-semibold text-[#102A5C] dark:text-blue-300">
                    {t.hub.transcriptTitle}
                  </h3>
                  <p dir="auto" className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {meetingResult.transcript}
                  </p>
                </article>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'finance' ? (
          <section className="space-y-5">
            <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA]/70 dark:bg-[#132852]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                  <Info className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0" aria-hidden="true" />
                  <span>{t.hub.financeGuideTitle}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed max-w-2xl">
                  {t.hub.financeGuideBody}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDraftInAssistant(t.hub.analyzeFinancePrompt)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 text-white shrink-0 whitespace-nowrap"
              >
                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.hub.analyzeFinanceAi}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {totalsByCurrency.map((row) => {
                const savingsRate =
                  row.income > 0 ? Math.round(((row.income - row.expense) / row.income) * 100) : 0;
                return (
                  <div
                    key={row.currency}
                    className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs font-semibold text-[#1E3A8A] dark:text-blue-300">
                        {row.currency}
                      </p>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        {t.hub.savingsRateLabel}: {formatNumber(savingsRate)}%
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{t.hub.totalIncomeLabel}</span>
                        <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                          +{formatNumber(row.income)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{t.hub.totalExpenseLabel}</span>
                        <span className="font-mono tabular-nums text-red-700 dark:text-red-400 font-medium">
                          -{formatNumber(row.expense)}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-blue-950/10 dark:border-blue-400/15 flex justify-between font-semibold text-[#0B1B3B] dark:text-slate-100">
                        <span>{t.hub.netBalanceLabel}</span>
                        <span className="font-mono tabular-nums">{formatNumber(row.net)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleAddFinance}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={finType}
                  onChange={(e) => setFinType(e.target.value as FinanceEntryType)}
                  className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="expense" className="bg-white dark:bg-[#0D1B36]">{t.hub.financeExpense}</option>
                  <option value="income" className="bg-white dark:bg-[#0D1B36]">{t.hub.financeIncome}</option>
                </select>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={finAmount}
                  onChange={(e) => setFinAmount(e.target.value)}
                  placeholder={t.hub.financeAmountPlaceholder}
                  className="min-h-[42px] px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <select
                  value={finCurrency}
                  onChange={(e) => setFinCurrency(e.target.value as FinanceCurrency)}
                  className="min-h-[42px] px-3 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="USD" className="bg-white dark:bg-[#0D1B36]">USD</option>
                  <option value="IRR" className="bg-white dark:bg-[#0D1B36]">IRR</option>
                  <option value="EUR" className="bg-white dark:bg-[#0D1B36]">EUR</option>
                </select>
                <input
                  type="date"
                  value={finDate}
                  onChange={(e) => setFinDate(e.target.value)}
                  className="min-h-[42px] px-3 py-2 text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  dir="auto"
                  value={finCategory}
                  onChange={(e) => setFinCategory(e.target.value)}
                  placeholder={t.hub.financeCategoryPlaceholder}
                  className="sm:w-1/3 min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  dir="auto"
                  value={finNote}
                  onChange={(e) => setFinNote(e.target.value)}
                  placeholder={t.hub.financeNotePlaceholder}
                  className="flex-1 min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!finAmount || Number(finAmount) <= 0}
                  className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg whitespace-nowrap"
                >
                  {t.hub.addEntryButton}
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3">
                <h3 className="text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.hub.budgetLimitsTitle}
                </h3>
                <form onSubmit={handleSetBudget} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    dir="auto"
                    value={budgetCat}
                    onChange={(e) => setBudgetCat(e.target.value)}
                    placeholder={t.hub.budgetCategoryPlaceholder}
                    className="sm:col-span-2 min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder={t.hub.budgetLimitPlaceholder}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <select
                    value={budgetCur}
                    onChange={(e) => setBudgetCur(e.target.value as FinanceCurrency)}
                    className="min-h-[38px] px-2.5 py-1.5 text-xs font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  >
                    <option value="USD" className="bg-white dark:bg-[#0D1B36]">USD</option>
                    <option value="IRR" className="bg-white dark:bg-[#0D1B36]">IRR</option>
                    <option value="EUR" className="bg-white dark:bg-[#0D1B36]">EUR</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!budgetCat.trim() || !budgetLimit || Number(budgetLimit) <= 0}
                    className="sm:col-span-4 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] hover:bg-blue-100 dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200 disabled:opacity-40"
                  >
                    {t.hub.setBudgetButton}
                  </button>
                </form>
                {budgetTargets.length > 0 ? (
                  <div className="space-y-2.5 pt-2 border-t border-blue-950/10 dark:border-blue-400/15">
                    {budgetTargets.map((b) => {
                      const spent = financialEntries
                        .filter(
                          (f) =>
                            f.type === 'expense' &&
                            f.currency === b.currency &&
                            f.category.toLowerCase() === b.category.toLowerCase()
                        )
                        .reduce((sum, f) => sum + f.amount, 0);
                      const pct = Math.min(Math.round((spent / Math.max(b.monthlyLimit, 1)) * 100), 100);
                      const rawPct = Math.round((spent / Math.max(b.monthlyLimit, 1)) * 100);
                      return (
                        <div key={`${b.category}-${b.currency}`} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span dir="auto" className="font-medium text-[#0B1B3B] dark:text-slate-100">
                              {b.category} ({b.currency})
                            </span>
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className={rawPct >= 100 ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                                {formatNumber(spent)} / {formatNumber(b.monthlyLimit)} ({rawPct}%)
                              </span>
                              {onDeleteBudgetTarget ? (
                                <button
                                  type="button"
                                  onClick={() => onDeleteBudgetTarget(b.category, b.currency)}
                                  aria-label={t.tasks.deleteTask}
                                  className="text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#EAF0FA] dark:bg-[#132852] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                rawPct >= 100
                                  ? 'bg-red-600'
                                  : rawPct >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-[#102A5C] dark:bg-blue-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3">
                <h3 className="text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.hub.categoryBreakdownTitle}
                </h3>
                {expenseBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">—</p>
                ) : (
                  <div className="space-y-2">
                    {expenseBreakdown.slice(0, 6).map((row) => {
                      const curTotal =
                        totalsByCurrency.find((c) => c.currency === row.currency)?.expense ?? row.total;
                      const share = Math.round((row.total / Math.max(curTotal, 1)) * 100);
                      return (
                        <div key={`${row.category}-${row.currency}`} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span dir="auto" className="font-medium text-slate-700 dark:text-slate-200">
                              {row.category}
                            </span>
                            <span className="font-mono tabular-nums text-[#0B1B3B] dark:text-slate-100">
                              {formatNumber(row.total)} {row.currency} ({share}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#EAF0FA] dark:bg-[#132852] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1E3A8A] dark:bg-blue-500"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#132852] border border-blue-900/10 dark:border-blue-400/20">
                {(['all', 'income', 'expense'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFinFilter(f)}
                    className={`min-h-[32px] px-3 py-1 text-xs font-medium rounded-md ${
                      finFilter === f
                        ? 'bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
                    }`}
                  >
                    {f === 'all'
                      ? t.tasks.filterAll
                      : f === 'income'
                        ? t.hub.financeIncome
                        : t.hub.financeExpense}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleExportFinanceCsv}
                disabled={financialEntries.length === 0}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568] disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.hub.exportFinanceCsv}</span>
              </button>
            </div>

            <div className="border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl divide-y divide-blue-950/10 dark:divide-blue-400/15">
              {filteredFinance.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">—</p>
              ) : (
                filteredFinance.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/60 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <p dir="auto" className="font-medium text-[#0B1B3B] dark:text-slate-100">
                        {item.category}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {item.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          item.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {item.type === 'income' ? '+' : '-'}
                        {formatNumber(item.amount)} {item.currency}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteFinancialEntry(item.id)}
                        aria-label={t.tasks.deleteTask}
                        className="p-1.5 rounded border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'vault' ? (
          <section className="space-y-5">
            <div className="p-4 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-[#EAF0FA]/70 dark:bg-[#132852]/70 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1B3B] dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0" aria-hidden="true" />
                <span>{t.hub.vaultGuideTitle}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {t.hub.vaultGuideBody}
              </p>
              <p className="text-[11px] font-mono text-[#102A5C]/80 dark:text-blue-300/80">
                {t.hub.vaultZeroPlaintextNote}
              </p>
            </div>

            {!sessionPassphrase ? (
              <div className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-4 max-w-lg">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {t.hub.vaultMasterPrompt}
                </p>
                <form onSubmit={(e) => void handleUnlockVault(e)} className="space-y-3">
                  <input
                    type="password"
                    value={vaultPassphrase}
                    onChange={(e) => setVaultPassphrase(e.target.value)}
                    placeholder={
                      vaultInitialized
                        ? t.hub.vaultUnlockPassPlaceholder
                        : t.hub.vaultCreatePassPlaceholder
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  {vaultError ? (
                    <p className="text-xs text-red-700 dark:text-red-400">{vaultError}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="submit"
                      disabled={vaultPassphrase.length < 4}
                      className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg"
                    >
                      <Unlock className="h-4 w-4" aria-hidden="true" />
                      <span>{t.hub.vaultUnlockButton}</span>
                    </button>
                    {vaultInitialized ? (
                      confirmVaultReset ? (
                        <button
                          type="button"
                          onClick={handleResetVault}
                          className="text-xs font-medium text-red-700 dark:text-red-400 underline"
                        >
                          Confirm Reset Vault
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmVaultReset(true)}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400"
                        >
                          Reset Vault
                        </button>
                      )
                    ) : null}
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {t.settings.vaultUnlockedStatus}
                  </span>
                  <button
                    type="button"
                    onClick={handleLockVault}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.hub.vaultLockButton}</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => void handleAddVaultSecret(e)}
                  className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] grid grid-cols-1 sm:grid-cols-4 gap-3"
                >
                  <input
                    type="text"
                    dir="auto"
                    value={vaultLabel}
                    onChange={(e) => setVaultLabel(e.target.value)}
                    placeholder={t.hub.vaultLabelPlaceholder}
                    className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={vaultUsername}
                    onChange={(e) => setVaultUsername(e.target.value)}
                    placeholder={t.hub.vaultUserPlaceholder}
                    className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={vaultSecret}
                    onChange={(e) => setVaultSecret(e.target.value)}
                    placeholder={t.hub.vaultSecretPlaceholder}
                    className="min-h-[42px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!vaultLabel.trim() || !vaultSecret.trim()}
                    className="min-h-[42px] px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg whitespace-nowrap"
                  >
                    {t.hub.vaultAddButton}
                  </button>
                </form>

                {vaultNotice ? (
                  <p className="text-xs text-[#102A5C] dark:text-blue-300 font-medium">{vaultNotice}</p>
                ) : null}

                <div className="border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl divide-y divide-blue-950/10 dark:divide-blue-400/15">
                  {vaultEntries.map((item) => {
                    const shown = Boolean(revealedIds[item.id]);
                    return (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p dir="auto" className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                            {item.label}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{item.username || '—'}</p>
                          <p className="text-xs font-mono text-[#102A5C] dark:text-blue-300 mt-1">
                            {shown ? item.secret : '••••••••••••'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedIds((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            className="p-2 rounded border border-blue-900/15 dark:border-blue-400/20 text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                            aria-label="Toggle reveal"
                          >
                            {shown ? (
                              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(item.secret);
                              setVaultNotice(`${item.label}: copied`);
                            }}
                            className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded border border-blue-900/15 dark:border-blue-400/20 text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#1A3568]"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.hub.vaultCopySecret}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteVaultSecret(item.id)}
                            aria-label={t.tasks.deleteTask}
                            className="p-2 rounded border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'activity' ? (
          <section className="space-y-4">
            <div className="relative max-w-sm">
              <Search
                className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                dir="auto"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder={t.hub.activitySearchPlaceholder}
                className="w-full min-h-[40px] ps-9 pe-3 py-2 text-sm rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl divide-y divide-blue-950/10 dark:divide-blue-400/15">
              {filteredActivity.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t.hub.activityEmpty}
                </p>
              ) : (
                filteredActivity.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p dir="auto" className="text-sm font-medium text-[#0B1B3B] dark:text-slate-100">
                        {log.title}
                      </p>
                      {log.details ? (
                        <p className="text-slate-600 dark:text-slate-300 font-mono truncate">{log.details}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                      <span className="uppercase text-slate-500 dark:text-slate-400">{log.category}</span>
                      <span
                        className={
                          log.status === 'error'
                            ? 'text-red-700 dark:text-red-400 font-semibold'
                            : log.status === 'warning'
                              ? 'text-amber-700 dark:text-amber-300 font-semibold'
                              : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        }
                      >
                        {log.status === 'error'
                          ? t.hub.statusError
                          : log.status === 'warning'
                            ? t.hub.statusWarning
                            : t.hub.statusSuccess}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">{formatDateTime(log.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
