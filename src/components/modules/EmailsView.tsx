import {
  ArrowRight,
  Clock,
  ExternalLink,
  Mail,
  PenSquare,
  RefreshCw,
  Reply,
  Search,
  Send,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import { GOOGLE_CLOUD_PROJECT_NUMBER } from '../../lib/firebase/firebase';
import { useAuth } from '../../lib/firebase/authContext';
import { summarizeEmailsDaily } from '../../services/assistantApi';
import {
  WorkspaceApiDisabledError,
  WorkspaceAuthExpiredError,
  createGmailDraft,
  listGmailMessages,
  sendGmailMessage,
  type GmailMessageSummary,
} from '../../services/workspaceGoogleApi';
import type {
  ActivityLogEntry,
  CachedEmailPreview,
  CornerNotificationItem,
  DailyEmailSummary,
} from '../../types/assistant';

interface EmailsViewProps {
  isOnline: boolean;
  cachedEmails: CachedEmailPreview[];
  onUpdateCachedEmails: (emails: CachedEmailPreview[]) => void;
  dailySummaries: DailyEmailSummary[];
  onSaveDailySummary: (summary: DailyEmailSummary) => void;
  onClearCachedMailbox: () => void;
  onDraftInAssistant: (prompt: string) => void;
  onLogActivity: (entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>) => void;
  onNotifyCorner?: (item: Omit<CornerNotificationItem, 'id' | 'createdAt'>) => void;
}

function getLocalDateKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isValidEmailRecipient(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const bracketed = trimmed.match(/<([^>]+)>/);
  const candidate = (bracketed ? bracketed[1] : trimmed).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate);
}

export function EmailsView({
  isOnline,
  cachedEmails,
  onUpdateCachedEmails,
  dailySummaries,
  onSaveDailySummary,
  onClearCachedMailbox,
  onDraftInAssistant,
  onLogActivity,
  onNotifyCorner,
}: EmailsViewProps) {
  const { t, language, formatDateTime } = useLanguage();
  const {
    user,
    googleAccessToken,
    isWorkspaceRemembered,
    workspaceAccountEmail,
    isRefreshingWorkspaceToken,
    refreshWorkspaceTokenSilently,
    connectGoogleWorkspace,
    disconnectGoogleWorkspace,
    clearGoogleAccessToken,
    authError,
    clearAuthError,
  } = useAuth();

  const [messages, setMessages] = useState<GmailMessageSummary[]>(cachedEmails);
  const [selectedId, setSelectedId] = useState<string | null>(
    cachedEmails[0]?.id ?? null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [summarizingDaily, setSummarizingDaily] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiDisabledInfo, setApiDisabledInfo] = useState<{
    gmailEnableUrl: string;
    calendarEnableUrl: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);
  const [replyThreadId, setReplyThreadId] = useState<string | undefined>(undefined);
  const [replyInReplyTo, setReplyInReplyTo] = useState<string | undefined>(undefined);
  const [sendingBusy, setSendingBusy] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const displayedMessages = messages.length > 0 ? messages : cachedEmails;
  const selectedMessage =
    displayedMessages.find((m) => m.id === selectedId) ??
    displayedMessages[0] ??
    null;

  const latestSummary = dailySummaries[0] ?? null;

  const ensureLiveAccessToken = useCallback(async (): Promise<string | null> => {
    if (googleAccessToken) return googleAccessToken;
    const silent = await refreshWorkspaceTokenSilently();
    if (silent) return silent;
    try {
      return await connectGoogleWorkspace();
    } catch {
      return null;
    }
  }, [googleAccessToken, refreshWorkspaceTokenSilently, connectGoogleWorkspace]);

  const fetchInbox = useCallback(
    async (queryText = searchQuery, tokenOverride?: string | null) => {
      const token = tokenOverride ?? googleAccessToken;
      if (!token || !isOnline) return;
      setLoading(true);
      setError(null);
      setApiDisabledInfo(null);
      try {
        const items = await listGmailMessages({
          accessToken: token,
          query: queryText,
          maxResults: 20,
        });
        setMessages(items);
        if (!queryText.trim()) {
          onUpdateCachedEmails(items);
        }
        if (items.length > 0) {
          setSelectedId((prev) =>
            prev && items.some((m) => m.id === prev) ? prev : items[0].id
          );
        } else {
          setSelectedId(null);
        }
      } catch (err) {
        if (err instanceof WorkspaceApiDisabledError) {
          setApiDisabledInfo({
            gmailEnableUrl: err.gmailEnableUrl,
            calendarEnableUrl: err.calendarEnableUrl,
          });
        } else if (err instanceof WorkspaceAuthExpiredError) {
          clearGoogleAccessToken();
        }
        setError(err instanceof Error ? err.message : 'Unable to load Gmail inbox.');
      } finally {
        setLoading(false);
      }
    },
    [
      googleAccessToken,
      isOnline,
      searchQuery,
      onUpdateCachedEmails,
      clearGoogleAccessToken,
    ]
  );

  useEffect(() => {
    if (googleAccessToken && isOnline) {
      void fetchInbox('');
    }
  }, [googleAccessToken, isOnline]);

  useEffect(() => {
    if (cachedEmails.length > 0 && messages.length === 0) {
      setMessages(cachedEmails);
      setSelectedId((prev) => prev ?? cachedEmails[0].id);
    }
  }, [cachedEmails, messages.length]);

  const handleConnect = async () => {
    setError(null);
    setNotice(null);
    setApiDisabledInfo(null);
    try {
      const token = await connectGoogleWorkspace();
      if (token && isOnline) {
        void fetchInbox(searchQuery, token);
      }
    } catch {
      // authError displays banner
    }
  };

  const handleRefreshLiveSession = async () => {
    setError(null);
    setApiDisabledInfo(null);
    const token = await ensureLiveAccessToken();
    if (token && isOnline) {
      void fetchInbox(searchQuery, token);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleWorkspace();
    onClearCachedMailbox();
    setMessages([]);
    setSelectedId(null);
    setApiDisabledInfo(null);
    setError(null);
    setNotice(null);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    void (async () => {
      const token = await ensureLiveAccessToken();
      if (token) {
        await fetchInbox(searchQuery, token);
      }
    })();
  };

  const openReply = (msg: GmailMessageSummary) => {
    const emailMatch = msg.from.match(/<([^>]+)>/);
    setComposeTo(emailMatch ? emailMatch[1] : msg.from);
    setComposeSubject(
      msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`
    );
    setComposeBody('');
    setComposeError(null);
    setReplyThreadId(msg.threadId || undefined);
    setReplyInReplyTo(msg.messageIdHeader);
    setComposing(true);
    setNotice(null);
  };

  const openBlankCompose = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeError(null);
    setReplyThreadId(undefined);
    setReplyInReplyTo(undefined);
    setComposing(true);
    setNotice(null);
  };

  const handleSaveDraft = async () => {
    setComposeError(null);
    if (!isValidEmailRecipient(composeTo)) {
      setComposeError(t.emails.validationToRequired);
      return;
    }
    const token = await ensureLiveAccessToken();
    if (!token) return;
    setSendingBusy(true);
    setError(null);
    setApiDisabledInfo(null);
    try {
      await createGmailDraft({
        accessToken: token,
        to: composeTo.trim(),
        subject: composeSubject.trim() || '(No Subject)',
        body: composeBody,
        threadId: replyThreadId,
        inReplyTo: replyInReplyTo,
      });
      setNotice(t.emails.draftSavedNotice);
      onLogActivity({
        category: 'agent',
        title: `Gmail draft saved: ${composeSubject.trim() || '(No Subject)'}`,
        details: composeTo.trim(),
        status: 'success',
      });
    } catch (err) {
      if (err instanceof WorkspaceApiDisabledError) {
        setApiDisabledInfo({
          gmailEnableUrl: err.gmailEnableUrl,
          calendarEnableUrl: err.calendarEnableUrl,
        });
      } else if (err instanceof WorkspaceAuthExpiredError) {
        clearGoogleAccessToken();
      }
      setError(err instanceof Error ? err.message : 'Failed to save draft.');
    } finally {
      setSendingBusy(false);
    }
  };

  const handleRequestSend = () => {
    setComposeError(null);
    if (!isValidEmailRecipient(composeTo)) {
      setComposeError(t.emails.validationToRequired);
      return;
    }
    setConfirmSendOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!isValidEmailRecipient(composeTo)) {
      setConfirmSendOpen(false);
      setComposeError(t.emails.validationToRequired);
      return;
    }
    setSendingBusy(true);
    setError(null);
    setApiDisabledInfo(null);
    try {
      const token = await ensureLiveAccessToken();
      if (!token) {
        setConfirmSendOpen(false);
        return;
      }
      const finalSubject = composeSubject.trim() || '(No Subject)';
      await sendGmailMessage({
        accessToken: token,
        to: composeTo.trim(),
        subject: finalSubject,
        body: composeBody,
        threadId: replyThreadId,
        inReplyTo: replyInReplyTo,
      });
      setConfirmSendOpen(false);
      setComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setNotice(t.emails.emailSentNotice);
      onLogActivity({
        category: 'agent',
        title: `Email sent via Gmail: ${finalSubject}`,
        details: composeTo.trim(),
        status: 'success',
      });
      void fetchInbox(searchQuery, token);
    } catch (err) {
      if (err instanceof WorkspaceApiDisabledError) {
        setApiDisabledInfo({
          gmailEnableUrl: err.gmailEnableUrl,
          calendarEnableUrl: err.calendarEnableUrl,
        });
      } else if (err instanceof WorkspaceAuthExpiredError) {
        clearGoogleAccessToken();
      }
      setError(err instanceof Error ? err.message : 'Failed to send email.');
      setConfirmSendOpen(false);
    } finally {
      setSendingBusy(false);
    }
  };

  const handleSummarizeImportantNow = async () => {
    if (!isOnline) return;
    setSummarizingDaily(true);
    setError(null);
    setApiDisabledInfo(null);
    try {
      let sourceEmails = displayedMessages;
      const token =
        googleAccessToken ?? (await refreshWorkspaceTokenSilently());
      if (token) {
        const fresh = await listGmailMessages({
          accessToken: token,
          maxResults: 20,
        });
        sourceEmails = fresh;
        setMessages(fresh);
        onUpdateCachedEmails(fresh);
      }

      const accountLabel =
        workspaceAccountEmail || user?.email || 'Connected Gmail';
      const result = await summarizeEmailsDaily({
        emails: sourceEmails.map((m) => ({
          id: m.id,
          subject: m.subject,
          from: m.from,
          date: m.date,
          unread: m.unread,
          snippet: m.snippet,
          bodyText: m.bodyText,
        })),
        language,
        accountEmail: accountLabel,
      });

      const dateKey = getLocalDateKey();
      onSaveDailySummary({
        id: `summary-${dateKey}`,
        dateKey,
        accountEmail: accountLabel,
        generatedAt: result.generatedAt,
        totalScanned: result.totalScanned,
        importantEmails: result.importantEmails,
        conclusion: result.conclusion,
        language,
      });

      onNotifyCorner?.({
        kind: 'email_summary',
        title: t.notifications.emailSummaryTitle,
        body: result.conclusion,
        meta: `${result.importantEmails.length} ${t.emails.importantCountLabel} · ${result.totalScanned} ${t.emails.scannedCountLabel}`,
        statusTone: 'success',
        actionSection: 'emails',
      });
    } catch (err) {
      if (err instanceof WorkspaceApiDisabledError) {
        setApiDisabledInfo({
          gmailEnableUrl: err.gmailEnableUrl,
          calendarEnableUrl: err.calendarEnableUrl,
        });
      }
      setError(
        err instanceof Error ? err.message : 'Failed to summarize important emails.'
      );
    } finally {
      setSummarizingDaily(false);
    }
  };

  const showConnectedWorkspace = Boolean(googleAccessToken || isWorkspaceRemembered);

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.emails.kicker}</p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
              {t.emails.title}
            </h2>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {t.emails.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showConnectedWorkspace ? (
              <>
                <button
                  type="button"
                  onClick={openBlankCompose}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <PenSquare className="h-4 w-4" aria-hidden="true" />
                  <span>{t.emails.composeButton}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDraftInAssistant(t.emails.askAssistantPrompt)}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-white dark:bg-[#0D1B36] border border-blue-900/20 dark:border-blue-400/25 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>{t.emails.summarizeInboxAi}</span>
                </button>
              </>
            ) : null}
          </div>
        </section>

        {!isOnline ? (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/45 flex items-center gap-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.emails.offlineNotice}</span>
          </div>
        ) : null}

        {apiDisabledInfo ? (
          <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/45 space-y-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
            <p className="font-semibold">{t.emails.apiDisabledTitle}</p>
            <p className="leading-relaxed opacity-90">{t.emails.apiDisabledBody}</p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={apiDisabledInfo.gmailEnableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#102A5C] text-white text-xs font-medium hover:bg-[#0B1D42]"
              >
                <span>{t.emails.enableGmailApi}</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href={
                  apiDisabledInfo.calendarEnableUrl ||
                  `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${GOOGLE_CLOUD_PROJECT_NUMBER}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1B36] border border-amber-400/50 text-[#0B1B3B] dark:text-slate-100 text-xs font-medium hover:bg-amber-100/60"
              >
                <span>{t.emails.enableCalendarApi}</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => void handleRefreshLiveSession()}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-amber-500/45 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.emails.retryConnection}</span>
              </button>
            </div>
          </div>
        ) : null}

        {authError || error ? (
          <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs sm:text-sm text-red-900 dark:text-red-200 flex items-center justify-between gap-3">
            <span className="break-words">{error ?? authError}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                clearAuthError();
              }}
              className="text-xs font-medium underline shrink-0"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : null}

        {notice ? (
          <div className="p-3.5 rounded-xl border border-blue-900/20 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] text-xs sm:text-sm text-[#102A5C] dark:text-blue-200 flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-medium underline shrink-0"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : null}

        {!showConnectedWorkspace ? (
          <>
            <section className="p-6 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA]/70 dark:bg-[#132852] space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.emails.noAccountTitle}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {t.emails.noAccountBody}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() => void handleConnect()}
                  className="min-h-[42px] inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-[#1F1F1F] dark:text-slate-100 bg-white dark:bg-[#0D1B36] border border-[#747775]/45 dark:border-blue-400/30 hover:bg-slate-50 dark:hover:bg-[#162F61] disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{t.emails.connectButton}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDraftInAssistant(t.emails.askAssistantPrompt)}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0"
                >
                  <span>{t.emails.askAssistant}</span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-blue-950/12 dark:border-blue-400/15">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.emails.capabilitiesTitle}
                </h3>
                <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl px-4">
                  <li className="py-3.5 space-y-1">
                    <p className="text-sm font-medium text-[#102A5C] dark:text-blue-300">{t.emails.cap1Title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{t.emails.cap1Desc}</p>
                  </li>
                  <li className="py-3.5 space-y-1">
                    <p className="text-sm font-medium text-[#102A5C] dark:text-blue-300">{t.emails.cap2Title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{t.emails.cap2Desc}</p>
                  </li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                  {t.emails.nextStepsTitle}
                </h3>
                <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl px-4">
                  <li className="py-3.5 flex items-baseline gap-3 text-sm">
                    <span className="font-mono tabular-nums text-xs text-[#1E3A8A]/70 dark:text-blue-300/75 shrink-0">
                      01.
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{t.emails.step1}</span>
                  </li>
                  <li className="py-3.5 flex items-baseline gap-3 text-sm">
                    <span className="font-mono tabular-nums text-xs text-[#1E3A8A]/70 dark:text-blue-300/75 shrink-0">
                      02.
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{t.emails.step2}</span>
                  </li>
                  <li className="py-3.5 flex items-baseline gap-3 text-sm">
                    <span className="font-mono tabular-nums text-xs text-[#1E3A8A]/70 dark:text-blue-300/75 shrink-0">
                      03.
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{t.emails.step3}</span>
                  </li>
                  <li className="py-3.5 flex items-baseline gap-3 text-sm">
                    <span className="font-mono tabular-nums text-xs text-[#1E3A8A]/70 dark:text-blue-300/75 shrink-0">
                      04.
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{t.emails.step4}</span>
                  </li>
                </ul>
              </section>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 text-[#102A5C] dark:text-blue-300 shrink-0" aria-hidden="true" />
                <span className="font-medium text-[#0B1B3B] dark:text-slate-100">{t.emails.connectedAsLabel}</span>
                <span className="truncate font-mono">
                  {workspaceAccountEmail ?? user?.email ?? 'Google Account'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleRefreshLiveSession()}
                  disabled={loading || isRefreshingWorkspaceToken || !isOnline}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#102A5C] dark:text-blue-200 border border-blue-900/20 dark:border-blue-400/25 rounded-lg hover:bg-[#EAF0FA] dark:hover:bg-[#132852] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading || isRefreshingWorkspaceToken ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>
                    {googleAccessToken ? t.emails.refreshInbox : t.emails.refreshLiveSession}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  className="min-h-[36px] inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-blue-400/25 rounded-lg hover:bg-slate-50 dark:hover:bg-[#132852]"
                >
                  {t.emails.reconnectButton}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="min-h-[36px] inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  {t.emails.disconnectMailbox}
                </button>
              </div>
            </div>

            {!googleAccessToken ? (
              <div className="p-3.5 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA]/70 dark:bg-[#132852] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold text-[#0B1B3B] dark:text-slate-100">
                    {t.emails.rememberedConnectionTitle}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    {t.emails.rememberedConnectionBody}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isOnline || isRefreshingWorkspaceToken}
                  onClick={() => void handleRefreshLiveSession()}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white font-medium hover:bg-[#0B1D42] dark:hover:bg-blue-500 shrink-0"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isRefreshingWorkspaceToken ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{t.emails.refreshLiveSession}</span>
                </button>
              </div>
            ) : null}

            {/* Daily 8:00 PM Important Emails Summary Card */}
            <section className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                      {t.emails.dailySummaryTitle}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF0FA] dark:bg-[#132852] text-[11px] font-medium text-[#102A5C] dark:text-blue-200">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {t.emails.dailySummaryScheduleBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t.emails.dailySummarySubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={summarizingDaily || !isOnline}
                  onClick={() => void handleSummarizeImportantNow()}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {summarizingDaily
                      ? t.emails.summarizingImportant
                      : t.emails.summarizeImportantNow}
                  </span>
                </button>
              </div>

              {latestSummary ? (
                <div className="space-y-3 pt-2 border-t border-blue-950/10 dark:border-blue-400/15">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono">
                      {latestSummary.dateKey} · {latestSummary.importantEmails.length}{' '}
                      {t.emails.importantCountLabel} · {latestSummary.totalScanned}{' '}
                      {t.emails.scannedCountLabel}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatDateTime(latestSummary.generatedAt)}
                    </span>
                  </div>

                  {latestSummary.importantEmails.length > 0 ? (
                    <ul className="space-y-2">
                      {latestSummary.importantEmails.map((item, idx) => (
                        <li
                          key={`${item.id}-${idx}`}
                          className="p-3 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/10 dark:border-blue-400/15 space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p
                              dir="auto"
                              className="text-xs sm:text-sm font-semibold text-[#0B1B3B] dark:text-slate-100"
                            >
                              {item.subject}
                            </p>
                            {item.importanceReason ? (
                              <span
                                dir="auto"
                                className="px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-[11px] font-medium"
                              >
                                {item.importanceReason}
                              </span>
                            ) : null}
                          </div>
                          <p dir="auto" className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.from}
                          </p>
                          <p
                            dir="auto"
                            className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
                          >
                            {item.summary}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.emails.noImportantEmails}
                    </p>
                  )}

                  <div className="p-3.5 rounded-lg bg-[#EAF0FA]/80 dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 space-y-1">
                    <p className="text-xs font-semibold text-[#102A5C] dark:text-blue-200">
                      {t.emails.dailyConclusionLabel}
                    </p>
                    <p
                      dir="auto"
                      className="text-xs sm:text-sm text-[#0B1B3B] dark:text-slate-100 leading-relaxed whitespace-pre-wrap"
                    >
                      {latestSummary.conclusion}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-3.5" aria-hidden="true" />
                <input
                  type="text"
                  dir="auto"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.emails.searchPlaceholder}
                  className="w-full min-h-[42px] ps-10 pe-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !isOnline}
                className="min-h-[42px] px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg shrink-0"
              >
                {t.emails.searchButton}
              </button>
            </form>

            {composing ? (
              <section className="p-5 rounded-xl border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                    {t.emails.composeButton}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    aria-label={t.emails.closeCompose}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-[#0B1B3B] dark:hover:text-white"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={composeTo}
                    onChange={(e) => {
                      setComposeTo(e.target.value);
                      if (composeError) setComposeError(null);
                    }}
                    placeholder={`${t.emails.toLabel}...`}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    dir="auto"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder={`${t.emails.subjectLabel}...`}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                  <textarea
                    rows={6}
                    dir="auto"
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder={`${t.emails.bodyLabel}...`}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>
                {composeError ? (
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">
                    {composeError}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-blue-400/25 rounded-lg hover:bg-slate-50 dark:hover:bg-[#132852]"
                  >
                    {t.emails.closeCompose}
                  </button>
                  <button
                    type="button"
                    disabled={sendingBusy || !isOnline}
                    onClick={() => void handleSaveDraft()}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-[#102A5C] dark:text-blue-200 bg-[#EAF0FA] dark:bg-[#132852] border border-blue-900/15 dark:border-blue-400/25 hover:bg-blue-100 dark:hover:bg-[#1A3568] disabled:opacity-50 rounded-lg"
                  >
                    {t.emails.saveDraftButton}
                  </button>
                  <button
                    type="button"
                    disabled={sendingBusy || !isOnline}
                    onClick={handleRequestSend}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {sendingBusy ? t.emails.sendingStatus : t.emails.sendEmailButton}
                    </span>
                  </button>
                </div>
              </section>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] overflow-hidden">
                {loading ? (
                  <div className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
                    {t.emails.loadingInbox}
                  </div>
                ) : displayedMessages.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
                    {t.emails.emptyInbox}
                  </div>
                ) : (
                  <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 max-h-[540px] overflow-y-auto">
                    {displayedMessages.map((msg) => {
                      const active = selectedMessage?.id === msg.id;
                      return (
                        <li key={msg.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(msg.id)}
                            className={`w-full text-start p-3.5 space-y-1 transition-colors border-s-2 ${
                              active
                                ? 'bg-[#EAF0FA]/80 dark:bg-[#162F61] border-[#102A5C] dark:border-blue-400'
                                : msg.unread
                                  ? 'bg-white dark:bg-[#0D1B36] border-blue-600 dark:border-blue-400 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/60'
                                  : 'bg-white dark:bg-[#0D1B36] border-transparent hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                dir="auto"
                                className={`text-xs truncate ${
                                  msg.unread
                                    ? 'font-semibold text-[#0B1B3B] dark:text-white'
                                    : 'font-medium text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {msg.from.replace(/<[^>]+>/g, '').trim()}
                              </span>
                              {msg.unread ? (
                                <span className="text-[11px] font-medium text-[#102A5C] dark:text-blue-300 shrink-0">
                                  {t.emails.unreadLabel}
                                </span>
                              ) : null}
                            </div>
                            <p
                              dir="auto"
                              className={`text-sm truncate ${
                                msg.unread ? 'font-semibold text-[#0B1B3B] dark:text-white' : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {msg.subject}
                            </p>
                            <p dir="auto" className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {msg.snippet}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="lg:col-span-7 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] p-5 space-y-4 min-h-[320px]">
                {selectedMessage ? (
                  <>
                    <div className="space-y-2 pb-4 border-b border-blue-950/10 dark:border-blue-400/15">
                      <h3 dir="auto" className="text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
                        {selectedMessage.subject}
                      </h3>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                        <p dir="auto">
                          <span className="font-medium text-[#102A5C] dark:text-blue-300">{t.emails.fromLabel}: </span>
                          {selectedMessage.from}
                        </p>
                        {selectedMessage.date ? (
                          <p>
                            <span className="font-medium text-[#102A5C] dark:text-blue-300">{t.emails.dateLabel}: </span>
                            <span className="font-mono tabular-nums">{selectedMessage.date}</span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => openReply(selectedMessage)}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg"
                        >
                          <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.emails.replyButton}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const prompt =
                              language === 'fa'
                                ? `این ایمیل را خلاصه کن و کارهای لازم را استخراج کن:\nموضوع: ${selectedMessage.subject}\nفرستنده: ${selectedMessage.from}\n\n${selectedMessage.bodyText.slice(0, 3500)}`
                                : `Summarize this email and extract any action items:\nSubject: ${selectedMessage.subject}\nFrom: ${selectedMessage.from}\n\n${selectedMessage.bodyText.slice(0, 3500)}`;
                            onDraftInAssistant(prompt);
                          }}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#102A5C] dark:text-blue-200 bg-[#EAF0FA] dark:bg-[#132852] hover:bg-blue-100 dark:hover:bg-[#1A3568] rounded-lg"
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.emails.summarizeMessageAi}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const prompt =
                              language === 'fa'
                                ? `یک پیش‌نویس پاسخ مودبانه برای این ایمیل بنویس و در Gmail آماده کن:\nگیرنده: ${selectedMessage.from}\nموضوع: Re: ${selectedMessage.subject}\nThread ID: ${selectedMessage.threadId}\n\nمتن اصلی:\n${selectedMessage.bodyText.slice(0, 2500)}`
                                : `Draft a clear reply for this email and save it as a Gmail draft (threadId: ${selectedMessage.threadId}):\nTo: ${selectedMessage.from}\nSubject: Re: ${selectedMessage.subject}\n\nOriginal:\n${selectedMessage.bodyText.slice(0, 2500)}`;
                            onDraftInAssistant(prompt);
                          }}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-blue-400/25 hover:bg-slate-50 dark:hover:bg-[#132852] rounded-lg"
                        >
                          <span>{t.emails.draftReplyAi}</span>
                        </button>
                      </div>
                    </div>
                    <div
                      dir="auto"
                      className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto"
                    >
                      {selectedMessage.bodyText || selectedMessage.snippet}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center py-12 text-xs text-slate-500 dark:text-slate-400">
                    {t.emails.selectMessagePrompt}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmSendOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-black/65 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#0D1B36] p-5 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.emails.sendConfirmTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.emails.sendConfirmBody}
            </p>
            <div className="p-3 rounded-lg bg-[#F8FAFD] dark:bg-[#09142B] border border-blue-900/15 dark:border-blue-400/20 space-y-1.5 text-xs text-[#0B1B3B] dark:text-slate-200">
              <p>
                <span className="font-semibold text-[#102A5C] dark:text-blue-300">{t.emails.toLabel}: </span>
                <span className="font-mono">{composeTo}</span>
              </p>
              <p dir="auto">
                <span className="font-semibold text-[#102A5C] dark:text-blue-300">{t.emails.subjectLabel}: </span>
                <span>{composeSubject.trim() || '(No Subject)'}</span>
              </p>
              <p dir="auto" className="text-slate-600 dark:text-slate-300 line-clamp-3 pt-1 border-t border-blue-900/10 dark:border-blue-400/15">
                {composeBody}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={sendingBusy}
                onClick={() => setConfirmSendOpen(false)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-blue-400/25 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#132852]"
              >
                {t.emails.sendConfirmCancel}
              </button>
              <button
                type="button"
                disabled={sendingBusy}
                onClick={() => void handleConfirmSend()}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:opacity-60"
              >
                {sendingBusy ? t.emails.sendingStatus : t.emails.sendConfirmProceed}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
