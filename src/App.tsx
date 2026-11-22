import { AlertCircle, BellRing, Check, CheckCircle2, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantWorkspace } from './components/chat/AssistantWorkspace';
import { DesignersModal } from './components/common/DesignersModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { CornerNotificationStack } from './components/notifications/CornerNotificationStack';
import { AutomationsView } from './components/modules/AutomationsView';
import { CalendarView } from './components/modules/CalendarView';
import { DevWorkbenchView } from './components/modules/DevWorkbenchView';
import { EmailsView } from './components/modules/EmailsView';
import { FilesView } from './components/modules/FilesView';
import { HubView } from './components/modules/HubView';
import { MemoryView } from './components/modules/MemoryView';
import { ResearchWebView } from './components/modules/ResearchWebView';
import { TasksView } from './components/modules/TasksView';
import { SettingsView } from './components/settings/SettingsView';
import { DEFAULT_OFFLINE_MODULES } from './config/defaultOfflineModules';
import { useComputerFiles } from './hooks/useComputerFiles';
import { useReminderScheduler } from './hooks/useReminderScheduler';
import { detectTextLanguage } from './i18n/detectLanguage';
import { LanguageProvider, useLanguage } from './i18n/languageContext';
import {
  AuthProvider,
  getInMemoryGoogleAccessToken,
  useAuth,
} from './lib/firebase/authContext';
import {
  OFFLINE_ENGINE_MODEL,
  executeOfflineCommand,
} from './lib/offline/offlineCommandEngine';
import { useExtendedWorkspaceStore } from './lib/offline/useExtendedWorkspaceStore';
import { useWorkspaceStore } from './lib/offline/useWorkspaceStore';
import {
  createComputerFolder,
  writeComputerBinaryFile,
} from './lib/platform/computerFiles';
import { sendLocalNotification } from './lib/platform';
import { ThemeProvider } from './lib/theme/themeContext';
import {
  AssistantApiError,
  createConversation,
  downloadRemoteUrl,
  fetchAgentOverview,
  fetchConversations,
  sendChatMessage,
  submitClientToolResults,
  summarizeEmailsDaily,
} from './services/assistantApi';
import {
  WorkspaceAuthExpiredError,
  createGmailDraft,
  getGmailMessage,
  listGmailMessages,
  listGoogleCalendarEvents,
  sendGmailMessage,
} from './services/workspaceGoogleApi';
import type {
  AutomationRule,
  CalendarEvent,
  ChatAttachment,
  ChatMessage,
  ClientToolCall,
  ClientToolResult,
  Conversation,
  DailyEmailSummary,
  NavigationSection,
  ReminderItem,
  ScheduledEventAction,
  WorkspaceMutation,
  WorkspaceSnapshot,
} from './types/assistant';

function AssistantShell() {
  const { language, dir, autoDetectLanguage, setLanguage, t } = useLanguage();
  const store = useWorkspaceStore();
  const extended = useExtendedWorkspaceStore();
  const computerFs = useComputerFiles();

  const [activeSection, setActiveSection] = useState<NavigationSection>('assistant');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [designersOpen, setDesignersOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    () => store.conversations[0]?.id ?? null
  );
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingStatusText, setSendingStatusText] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const {
    clearGoogleAccessToken,
    googleAccessToken,
    isWorkspaceRemembered,
    workspaceAccountEmail,
    refreshWorkspaceTokenSilently,
    connectGoogleWorkspace,
    status: authStatus,
  } = useAuth();
  const dailySummaryInFlightRef = useRef(false);
  const [pendingDeletePaths, setPendingDeletePaths] = useState<string[] | null>(null);
  const deleteResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const [pendingSendEmail, setPendingSendEmail] = useState<{
    to: string;
    subject: string;
    body: string;
  } | null>(null);
  const sendEmailResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const handleReminderTriggered = useCallback(
    (rem: ReminderItem) => {
      extended.logActivity({
        category: 'automation',
        title: `Reminder due: ${rem.title}`,
        details: rem.dueAt,
        status: 'warning',
      });
    },
    [extended.logActivity]
  );

  const handleExecuteScheduledEvent = useCallback(
    async (
      ev: CalendarEvent,
      action?: ScheduledEventAction
    ): Promise<{ outcome?: string; failed?: boolean } | undefined> => {
      extended.logActivity({
        category: 'automation',
        title: `Calendar event due: ${ev.title}`,
        details: ev.location ? `${ev.startTime} · ${ev.location}` : ev.startTime,
        status: 'warning',
      });

      if (!action || action.actionType === 'none') {
        if (action && action.actionStatus === 'pending') {
          extended.updateEventScheduledActionState(ev.id, {
            notifiedAt: new Date().toISOString(),
            actionStatus: 'executed',
            actionResult: t.notifications.notificationDelivered,
          });
          return { outcome: t.notifications.notificationDelivered, failed: false };
        }
        return {
          outcome: action?.actionResult || t.notifications.notificationDelivered,
          failed: action?.actionStatus === 'failed',
        };
      }

      if (action.actionStatus !== 'pending') {
        return {
          outcome: action.actionResult,
          failed: action.actionStatus === 'failed',
        };
      }

      try {
        let outcome = '';
        if (action.actionType === 'create_folder' && action.folderPath) {
          const granted = computerFs.mounts.filter((m) => m.permission === 'granted');
          if (granted.length === 0) {
            throw new Error('No connected PC folder is granted in this session.');
          }
          const res = await createComputerFolder(computerFs.mounts, action.folderPath);
          await computerFs.refreshMounts();
          outcome = `Folder created: ${res.path}`;
        } else if (action.actionType === 'download_url' && action.url) {
          const res = await downloadRemoteUrl(action.url);
          const granted = computerFs.mounts.filter((m) => m.permission === 'granted');
          let savedLocation: 'computer_folder' | 'browser_download' = 'browser_download';
          if (granted.length > 0) {
            const rawBytes = new Uint8Array(await res.blob.arrayBuffer());
            const dest = `${granted[0].name}/Downloads/${res.filename}`;
            const writeRes = await writeComputerBinaryFile(computerFs.mounts, dest, rawBytes);
            await computerFs.refreshMounts();
            savedLocation = 'computer_folder';
            outcome = `Downloaded to ${writeRes.path}`;
          } else {
            const blobUrl = URL.createObjectURL(res.blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = res.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
            outcome = `Downloaded ${res.filename}`;
          }
          extended.addDownloadRecord({
            url: res.url,
            filename: res.filename,
            mimeType: res.mimeType,
            sizeBytes: res.sizeBytes,
            savedLocation,
          });
        } else if (action.actionType === 'create_task') {
          const taskTitle = action.taskTitle?.trim() || ev.title;
          await store.createTask({
            title: taskTitle,
            priority: action.taskPriority ?? 'medium',
          });
          outcome = `Task created: ${taskTitle}`;
        } else if (action.actionType === 'create_document') {
          const docTitle = action.docTitle?.trim() || ev.title;
          await store.createDocument({
            title: docTitle,
            content: action.docContent || `Scheduled document for event: ${ev.title}`,
            folder: 'Scheduled',
          });
          outcome = `Document created: ${docTitle}`;
        }

        extended.updateEventScheduledActionState(ev.id, {
          notifiedAt: new Date().toISOString(),
          actionStatus: 'executed',
          actionResult: outcome,
        });
        extended.logActivity({
          category: 'automation',
          title: `Calendar scheduled action completed (${ev.title})`,
          details: outcome,
          status: 'success',
        });
        return { outcome, failed: false };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Scheduled action failed.';
        extended.updateEventScheduledActionState(ev.id, {
          notifiedAt: new Date().toISOString(),
          actionStatus: 'failed',
          actionResult: msg,
        });
        extended.logActivity({
          category: 'automation',
          title: `Calendar scheduled action failed (${ev.title})`,
          details: msg,
          status: 'error',
        });
        return { outcome: msg, failed: true };
      }
    },
    [
      computerFs.mounts,
      computerFs.refreshMounts,
      extended,
      store.createTask,
      store.createDocument,
      t.notifications.notificationDelivered,
    ]
  );

  const {
    activeDueAlert,
    dismissDueAlert,
    activeEventAlert,
    dismissEventAlert,
    cornerNotifications,
    pushCornerNotification,
    dismissCornerNotification,
  } = useReminderScheduler(
    extended.reminders,
    extended.markReminderNotified,
    handleReminderTriggered,
    store.events,
    extended.scheduledEventActions,
    handleExecuteScheduledEvent
  );

  const requestDeleteConfirmation = useCallback((paths: string[]) => {
    return new Promise<boolean>((resolve) => {
      deleteResolverRef.current = resolve;
      setPendingDeletePaths(paths);
    });
  }, []);

  const resolveDeletePrompt = (approved: boolean) => {
    const resolver = deleteResolverRef.current;
    deleteResolverRef.current = null;
    setPendingDeletePaths(null);
    if (resolver) resolver(approved);
  };

  const requestSendEmailConfirmation = useCallback(
    (payload: { to: string; subject: string; body: string }) => {
      return new Promise<boolean>((resolve) => {
        sendEmailResolverRef.current = resolve;
        setPendingSendEmail(payload);
      });
    },
    []
  );

  const resolveSendEmailPrompt = (approved: boolean) => {
    const resolver = sendEmailResolverRef.current;
    sendEmailResolverRef.current = null;
    setPendingSendEmail(null);
    if (resolver) resolver(approved);
  };

  const loadOverview = useCallback(async () => {
    if (!store.isOnline) return;
    setIsRefreshing(true);
    try {
      const overview = await fetchAgentOverview();
      store.setCachedOverview(overview.readiness, overview.modules);
    } catch {
      // Keep cached readiness & modules available offline
    } finally {
      setIsRefreshing(false);
    }
  }, [store.isOnline, store.setCachedOverview]);

  const loadConversations = useCallback(async () => {
    if (!store.isOnline) return;
    try {
      const list = await fetchConversations();
      if (list.length > 0) {
        store.setCachedConversations(list);
        setActiveConversationId((prev) => prev ?? list[0].id);
      }
    } catch {
      // Keep cached conversations available offline
    }
  }, [store.isOnline, store.setCachedConversations]);

  useEffect(() => {
    void loadOverview();
    void loadConversations();
  }, [loadOverview, loadConversations]);

  useEffect(() => {
    const maybeRunDaily8PmSummary = async () => {
      if (dailySummaryInFlightRef.current) return;
      if (!store.isOnline) return;
      if (!googleAccessToken && !isWorkspaceRemembered) return;

      const now = new Date();
      if (now.getHours() < 20) return;

      const pad = (n: number) => String(n).padStart(2, '0');
      const dateKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      if (extended.dailyEmailSummaries.some((s) => s.dateKey === dateKey)) {
        return;
      }

      dailySummaryInFlightRef.current = true;
      try {
        let token = getInMemoryGoogleAccessToken();
        if (!token) {
          token = await refreshWorkspaceTokenSilently();
        }

        let sourceEmails = extended.cachedEmails;
        if (token) {
          try {
            const live = await listGmailMessages({ accessToken: token, maxResults: 20 });
            extended.setCachedEmails(live);
            sourceEmails = live;
          } catch {
            // Fall back to cached emails if Gmail fetch fails temporarily
          }
        }

        if (sourceEmails.length === 0) return;

        const res = await summarizeEmailsDaily({
          emails: sourceEmails,
          language,
          accountEmail: workspaceAccountEmail || undefined,
        });

        const summary: DailyEmailSummary = {
          id: `summary-${dateKey}`,
          dateKey,
          accountEmail: workspaceAccountEmail || 'Connected Gmail',
          generatedAt: res.generatedAt,
          totalScanned: res.totalScanned,
          importantEmails: res.importantEmails,
          conclusion: res.conclusion,
          language,
        };
        extended.upsertDailyEmailSummary(summary);
        extended.logActivity({
          category: 'automation',
          title: `Daily 8:00 PM email summary generated (${res.importantEmails.length} important)`,
          details: res.conclusion,
          status: 'success',
        });
        await sendLocalNotification(t.notifications.emailSummaryTitle, res.conclusion);
        pushCornerNotification({
          kind: 'email_summary',
          title: t.notifications.emailSummaryTitle,
          body: res.conclusion,
          meta: `${res.importantEmails.length} / ${res.totalScanned}`,
          statusTone: 'success',
          actionSection: 'emails',
        });
      } catch {
        // Retry on next scheduler tick if transient
      } finally {
        dailySummaryInFlightRef.current = false;
      }
    };

    void maybeRunDaily8PmSummary();
    const timer = window.setInterval(() => {
      void maybeRunDaily8PmSummary();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [
    store.isOnline,
    googleAccessToken,
    isWorkspaceRemembered,
    workspaceAccountEmail,
    extended.dailyEmailSummaries,
    extended.cachedEmails,
    extended.setCachedEmails,
    extended.upsertDailyEmailSummary,
    extended.logActivity,
    refreshWorkspaceTokenSilently,
    language,
    t.notifications.emailSummaryTitle,
    pushCornerNotification,
  ]);

  const activeConversation =
    store.conversations.find((item) => item.id === activeConversationId) ?? null;

  const getFullWorkspaceSnapshot = useCallback((): WorkspaceSnapshot => {
    const base = store.getWorkspaceSnapshot();
    return {
      ...base,
      reminders: extended.reminders,
      financialEntries: extended.financialEntries,
      dataTables: extended.dataTables,
      clipboardHistory: extended.clipboardHistory,
      activityLogs: extended.activityLogs,
    };
  }, [
    store,
    extended.reminders,
    extended.financialEntries,
    extended.dataTables,
    extended.clipboardHistory,
    extended.activityLogs,
  ]);

  const applyExtendedMutations = useCallback(
    (mutations: WorkspaceMutation[]) => {
      for (const mut of mutations) {
        switch (mut.type) {
          case 'reminder_created':
            extended.upsertReminder(mut.item);
            break;
          case 'reminder_completed':
            extended.completeReminder(mut.id);
            break;
          case 'financial_entry_created':
            extended.upsertFinancialEntry(mut.item);
            break;
          case 'data_table_created':
            extended.upsertDataTable(mut.item);
            break;
          case 'data_table_row_inserted':
            extended.insertTableRow(mut.tableId, mut.row);
            break;
          default:
            break;
        }
      }
    },
    [extended]
  );

  const handleNewConversation = async () => {
    setChatError(null);
    setActiveSection('assistant');
    if (!store.isOnline) {
      const now = new Date().toISOString();
      const localConv: Conversation = {
        id: `offline-${Date.now()}`,
        title: language === 'fa' ? 'گفتگوی آفلاین' : 'Offline Thread',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      store.setCachedConversations([localConv, ...store.conversations]);
      setActiveConversationId(localConv.id);
      return;
    }
    try {
      const created = await createConversation();
      store.setCachedConversations([created, ...store.conversations]);
      setActiveConversationId(created.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create a new thread.';
      setChatError(message);
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    const remaining = store.conversations.filter((c) => c.id !== conversationId);
    store.setCachedConversations(remaining);
    if (activeConversationId === conversationId) {
      setActiveConversationId(remaining[0]?.id ?? null);
    }
  };

  const handleSendMessage = async (content: string, attachments?: ChatAttachment[]) => {
    const detected = detectTextLanguage(content);
    const effectiveLanguage = autoDetectLanguage ? detected : language;
    if (autoDetectLanguage && detected !== language) {
      setLanguage(detected);
    }

    if (!store.isOnline) {
      setIsSending(true);
      setChatError(null);
      try {
        const result = await executeOfflineCommand(
          content,
          effectiveLanguage,
          getFullWorkspaceSnapshot(),
          {
            createTask: store.createTask,
            updateTaskStatus: store.updateTaskStatus,
            deleteTask: store.deleteTask,
            createEvent: store.createEvent,
            createDocument: store.createDocument,
            createMemory: store.createMemory,
            createAutomation: store.createAutomation,
          },
          computerFs.mounts
        );

        const targetConv = activeConversation;
        const targetConvId = targetConv?.id ?? `offline-${Date.now()}`;
        const now = new Date().toISOString();
        const userMsg: ChatMessage = {
          id: `offline-user-${Date.now()}`,
          conversationId: targetConvId,
          role: 'user',
          content,
          createdAt: now,
          language: detected,
          attachmentNames: attachments?.map((a) => a.name),
        };
        const assistantMsg: ChatMessage = {
          id: `offline-assistant-${Date.now() + 1}`,
          conversationId: targetConvId,
          role: 'assistant',
          content: result.reply,
          createdAt: new Date().toISOString(),
          model: OFFLINE_ENGINE_MODEL,
          language: result.language,
          toolActions: result.toolActions.length > 0 ? result.toolActions : undefined,
        };

        const nextConv: Conversation = targetConv
          ? {
              ...targetConv,
              updatedAt: assistantMsg.createdAt,
              title:
                targetConv.messages.length === 0
                  ? content.slice(0, 48)
                  : targetConv.title,
              messages: [...targetConv.messages, userMsg, assistantMsg],
            }
          : {
              id: targetConvId,
              title: content.slice(0, 48),
              createdAt: now,
              updatedAt: assistantMsg.createdAt,
              messages: [userMsg, assistantMsg],
            };

        const exists = store.conversations.some((c) => c.id === nextConv.id);
        const updatedList = exists
          ? store.conversations.map((c) => (c.id === nextConv.id ? nextConv : c))
          : [nextConv, ...store.conversations];

        setDraft('');
        setActiveConversationId(nextConv.id);
        store.setCachedConversations(updatedList);
        await computerFs.refreshMounts();
        extended.logActivity({
          category: 'agent',
          title: 'Offline agent command executed',
          details: result.toolActions.join(', ') || content.slice(0, 80),
          status: 'success',
        });
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : 'Offline command failed.'
        );
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    setSendingStatusText(null);
    setChatError(null);
    try {
      const attachmentPreviews = attachments
        ?.filter((a) => a.kind === 'image' && Boolean(a.base64Data))
        .map((a) => ({
          name: a.name,
          dataUrl: `data:${a.mimeType || 'image/png'};base64,${a.base64Data}`,
        }));

      let response = await sendChatMessage({
        message: content,
        conversationId: activeConversationId ?? undefined,
        uiLanguage: effectiveLanguage,
        history: (activeConversation?.messages ?? []).map((m) =>
          m.attachmentPreviews ? { ...m, attachmentPreviews: undefined } : m
        ),
        workspaceContext: getFullWorkspaceSnapshot(),
        computerFsContext: computerFs.getComputerFsContext(),
        attachments,
      });

      let roundGuard = 0;
      while (response.status === 'requires_client_tools' && roundGuard < 12) {
        roundGuard += 1;
        setSendingStatusText(t.chat.runningComputerTools);

        const snap = getFullWorkspaceSnapshot();
        const extendedMap = new Map<string, ClientToolResult>();
        const fsCalls: ClientToolCall[] = [];

        for (const call of response.pendingToolCalls) {
          if (
            call.name === 'check_emails' ||
            call.name === 'read_email_detail' ||
            call.name === 'create_email_draft' ||
            call.name === 'prepare_send_email' ||
            call.name === 'list_google_calendar_events'
          ) {
            let accessToken = getInMemoryGoogleAccessToken();
            if (!accessToken && isWorkspaceRemembered) {
              accessToken = await refreshWorkspaceTokenSilently();
            }
            if (!accessToken) {
              extendedMap.set(call.id, {
                id: call.id,
                name: call.name,
                response: {
                  connected: false,
                  message:
                    'Google Workspace (Gmail & Calendar) is not connected in this browser session. Ask the user to click "Connect Gmail & Calendar" in the Emails or Calendar view.',
                },
              });
              continue;
            }
            const args = (call.args ?? {}) as Record<string, unknown>;
            try {
              if (call.name === 'check_emails') {
                const items = await listGmailMessages({
                  accessToken,
                  query: typeof args.query === 'string' ? args.query : undefined,
                  maxResults:
                    typeof args.maxResults === 'number' ? args.maxResults : 10,
                });
                extendedMap.set(call.id, {
                  id: call.id,
                  name: call.name,
                  response: {
                    connected: true,
                    count: items.length,
                    messages: items.map((m) => ({
                      id: m.id,
                      threadId: m.threadId,
                      subject: m.subject,
                      from: m.from,
                      date: m.date,
                      unread: m.unread,
                      snippet: m.snippet,
                    })),
                  },
                });
              } else if (call.name === 'read_email_detail') {
                const msg = await getGmailMessage({
                  accessToken,
                  id: String(args.messageId ?? ''),
                });
                extendedMap.set(call.id, {
                  id: call.id,
                  name: call.name,
                  response: { connected: true, message: msg },
                });
              } else if (call.name === 'create_email_draft') {
                const draftRes = await createGmailDraft({
                  accessToken,
                  to: String(args.to ?? ''),
                  subject: String(args.subject ?? ''),
                  body: String(args.body ?? ''),
                  threadId:
                    typeof args.threadId === 'string' ? args.threadId : undefined,
                });
                extendedMap.set(call.id, {
                  id: call.id,
                  name: call.name,
                  response: { connected: true, draftSaved: true, ...draftRes },
                });
              } else if (call.name === 'prepare_send_email') {
                const to = String(args.to ?? '');
                const subject = String(args.subject ?? '');
                const body = String(args.body ?? '');
                const approved = await requestSendEmailConfirmation({
                  to,
                  subject,
                  body,
                });
                if (!approved) {
                  extendedMap.set(call.id, {
                    id: call.id,
                    name: call.name,
                    response: {
                      connected: true,
                      sent: false,
                      cancelledByUser: true,
                    },
                  });
                } else {
                  const sentRes = await sendGmailMessage({
                    accessToken,
                    to,
                    subject,
                    body,
                    threadId:
                      typeof args.threadId === 'string' ? args.threadId : undefined,
                  });
                  extendedMap.set(call.id, {
                    id: call.id,
                    name: call.name,
                    response: { connected: true, sent: true, ...sentRes },
                  });
                }
              } else if (call.name === 'list_google_calendar_events') {
                const calEvents = await listGoogleCalendarEvents({
                  accessToken,
                  maxResults:
                    typeof args.maxResults === 'number' ? args.maxResults : 15,
                });
                extendedMap.set(call.id, {
                  id: call.id,
                  name: call.name,
                  response: {
                    connected: true,
                    count: calEvents.length,
                    events: calEvents,
                  },
                });
              }
            } catch (err) {
              if (err instanceof WorkspaceAuthExpiredError) {
                clearGoogleAccessToken();
              }
              extendedMap.set(call.id, {
                id: call.id,
                name: call.name,
                response: {
                  connected: false,
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Google Workspace request failed.',
                },
              });
            }
            continue;
          }

          const extRes = await extended.executeExtendedClientTool(
            call.name,
            call.args ?? {},
            snap,
            computerFs.mounts
          );
          if (extRes !== null) {
            extendedMap.set(call.id, {
              id: call.id,
              name: call.name,
              response: extRes,
            });
          } else {
            fsCalls.push(call);
          }
        }

        const fsResults =
          fsCalls.length > 0
            ? await computerFs.executeClientToolCalls(
                fsCalls,
                requestDeleteConfirmation
              )
            : [];
        const fsMap = new Map(fsResults.map((r) => [r.id, r]));

        const toolResults: ClientToolResult[] = response.pendingToolCalls.map(
          (call) =>
            extendedMap.get(call.id) ??
            fsMap.get(call.id) ?? {
              id: call.id,
              name: call.name,
              response: { success: false, error: 'Tool handler unavailable.' },
            }
        );

        extended.logActivity({
          category: fsCalls.length > 0 ? 'files' : 'system',
          title: `Client tools executed (${response.pendingToolCalls
            .map((c) => c.name)
            .join(', ')})`,
          status: 'success',
        });

        setSendingStatusText(null);
        response = await submitClientToolResults({
          pendingSessionId: response.pendingSessionId,
          toolResults,
        });
      }

      if (response.status !== 'completed') {
        throw new Error('Tool execution exceeded maximum steps.');
      }

      setDraft('');
      const prevConv = store.conversations.find(
        (c) => c.id === response.conversation.id
      );
      const prevPreviewMap = new Map(
        (prevConv?.messages ?? [])
          .filter((m) => m.attachmentPreviews && m.attachmentPreviews.length > 0)
          .map((m) => [m.id, m.attachmentPreviews])
      );
      const mergedConversation: Conversation = {
        ...response.conversation,
        messages: response.conversation.messages.map((m) => {
          if (m.id === response.userMessage.id && attachmentPreviews && attachmentPreviews.length > 0) {
            return { ...m, attachmentPreviews };
          }
          const oldPreviews = prevPreviewMap.get(m.id);
          return oldPreviews ? { ...m, attachmentPreviews: oldPreviews } : m;
        }),
      };

      setActiveConversationId(mergedConversation.id);
      const exists = Boolean(prevConv);
      const updatedConversations = exists
        ? store.conversations.map((c) =>
            c.id === mergedConversation.id ? mergedConversation : c
          )
        : [mergedConversation, ...store.conversations];
      store.setCachedConversations(updatedConversations);

      if (response.mutations && response.mutations.length > 0) {
        const remaining = await store.applyServerMutations(response.mutations);
        if (remaining.length > 0) {
          applyExtendedMutations(remaining);
        }
      }

      if (response.toolActions.length > 0) {
        extended.logActivity({
          category: 'agent',
          title: `Agent completed tools: ${response.toolActions.join(', ')}`,
          status: 'success',
        });
      }
    } catch (error) {
      const msg =
        error instanceof AssistantApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to send message.';
      setChatError(msg);
      extended.logActivity({
        category: 'agent',
        title: 'Assistant request error',
        details: msg,
        status: 'error',
      });
    } finally {
      setSendingStatusText(null);
      setIsSending(false);
    }
  };

  const handleDraftInAssistant = (prompt: string) => {
    setDraft(prompt);
    setActiveSection('assistant');
  };

  const handleRunAutomation = async (rule: AutomationRule) => {
    const openTasks = store.tasks.filter((x) => x.status !== 'completed');
    const dueReminders = extended.reminders.filter((r) => !r.completed);
    const reportBody = [
      `# Automation Run: ${rule.name}`,
      `Executed at: ${new Date().toISOString()}`,
      `Trigger: ${rule.trigger}`,
      `Configured Action: ${rule.actionSummary}`,
      '',
      `## Current Workspace Summary`,
      `- Open tasks: ${openTasks.length}`,
      `- Scheduled calendar events: ${store.events.length}`,
      `- Active reminders: ${dueReminders.length}`,
      `- Stored memories: ${store.memories.length}`,
      '',
      openTasks.length > 0
        ? `## Top Open Tasks\n${openTasks
            .slice(0, 6)
            .map((x) => `- [${x.priority}] ${x.title}${x.dueDate ? ` (${x.dueDate})` : ''}`)
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    await store.createDocument({
      title: `Automation: ${rule.name} (${new Date().toISOString().slice(0, 10)})`,
      folder: 'Automations',
      content: reportBody,
    });
    await sendLocalNotification(rule.name, t.extras.automationRanNotice);
    extended.logActivity({
      category: 'automation',
      title: `Automation executed: ${rule.name}`,
      details: rule.actionSummary,
      status: 'success',
    });
  };

  const handleRestoreBackupSnapshot = async (
    data: Partial<WorkspaceSnapshot>
  ): Promise<number> => {
    let count = 0;
    if (Array.isArray(data.tasks)) {
      for (const item of data.tasks) {
        if (item?.title) {
          await store.createTask({
            title: item.title,
            priority: item.priority ?? 'medium',
            dueDate: item.dueDate,
            sourceLanguage: item.sourceLanguage,
          });
          count += 1;
        }
      }
    }
    if (Array.isArray(data.events)) {
      for (const ev of data.events) {
        if (ev?.title && ev?.startTime) {
          await store.createEvent({
            title: ev.title,
            startTime: ev.startTime,
            location: ev.location,
            sourceLanguage: ev.sourceLanguage,
          });
          count += 1;
        }
      }
    }
    if (Array.isArray(data.documents)) {
      for (const d of data.documents) {
        if (d?.title) {
          await store.createDocument({
            title: d.title,
            content: d.content ?? '',
            folder: d.folder ?? 'Restored',
            sourceLanguage: d.sourceLanguage,
          });
          count += 1;
        }
      }
    }
    if (Array.isArray(data.memories)) {
      for (const m of data.memories) {
        if (m?.fact) {
          await store.createMemory({
            fact: m.fact,
            category: m.category ?? 'context',
            sourceLanguage: m.sourceLanguage,
          });
          count += 1;
        }
      }
    }
    if (Array.isArray(data.reminders)) {
      for (const r of data.reminders) {
        if (r?.title && r?.dueAt) {
          extended.upsertReminder(r);
          count += 1;
        }
      }
    }
    if (Array.isArray(data.financialEntries)) {
      for (const f of data.financialEntries) {
        if (typeof f?.amount === 'number') {
          extended.upsertFinancialEntry(f);
          count += 1;
        }
      }
    }
    if (Array.isArray(data.dataTables)) {
      for (const tbl of data.dataTables) {
        if (tbl?.name && Array.isArray(tbl.columns)) {
          extended.upsertDataTable(tbl);
          count += 1;
        }
      }
    }

    extended.logActivity({
      category: 'files',
      title: `Backup restored (${count} records)`,
      status: 'success',
    });
    return count;
  };

  return (
    <div
      dir={dir}
      className="h-[100dvh] safe-area-shell w-full flex overflow-hidden bg-[#F3F6FB] dark:bg-[#060E20] text-[#0B1B3B] dark:text-slate-100"
    >
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenDesigners={() => setDesignersOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNewConversation={() => void handleNewConversation()}
          onOpenAssistant={() => setActiveSection('assistant')}
          onRefreshOverview={() => void loadOverview()}
          isRefreshing={isRefreshing}
          isOnline={store.isOnline}
          pendingCount={store.pendingCount}
          isSyncing={store.isSyncing}
          onSyncNow={() => void store.syncPendingChanges()}
        />

        {!store.isOnline ? (
          <div className="shrink-0 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-500/30 px-4 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300 shrink-0" aria-hidden="true" />
              <span className="font-medium truncate">{t.offline.bannerTitle}</span>
              <span className="hidden md:inline text-amber-900/90 dark:text-amber-200/85 truncate">
                — {t.offline.bannerDetail}
              </span>
            </div>
          </div>
        ) : null}

        {store.syncError ? (
          <div className="shrink-0 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-500/30 px-4 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs text-red-900 dark:text-red-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {t.offline.syncFailedPrefix} {store.syncError}
              </span>
            </div>
            <button
              type="button"
              onClick={store.clearSyncMessages}
              className="font-medium underline shrink-0"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : store.syncNotice === 'SYNC_OK' ? (
          <div className="shrink-0 bg-[#EAF0FA] dark:bg-[#132954] border-b border-blue-900/15 dark:border-blue-400/20 px-4 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs text-[#102A5C] dark:text-blue-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t.offline.syncCompleted}</span>
            </div>
            <button
              type="button"
              onClick={store.clearSyncMessages}
              className="font-medium underline shrink-0"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : null}

        {activeDueAlert ? (
          <div className="shrink-0 bg-[#102A5C] text-white border-b border-blue-950 px-4 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <BellRing className="h-3.5 w-3.5 text-blue-200 shrink-0" aria-hidden="true" />
              <span className="font-medium truncate">
                {t.extras.dueAlertBannerPrefix} {activeDueAlert.title}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  extended.completeReminder(activeDueAlert.id);
                  dismissDueAlert();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-white text-[#102A5C] font-medium hover:bg-blue-50"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                <span>{t.tasks.markDone}</span>
              </button>
              <button
                type="button"
                onClick={dismissDueAlert}
                aria-label={t.chat.dismiss}
                className="p-1 text-blue-200 hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {activeEventAlert ? (
          <div className="shrink-0 bg-[#0B1B3B] text-white border-b border-blue-950 px-4 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <BellRing className="h-4 w-4 text-blue-200 shrink-0" aria-hidden="true" />
              <span className="font-semibold truncate">
                {t.calendar.eventAlertBannerPrefix} {activeEventAlert.event.title}
              </span>
              {activeEventAlert.event.location ? (
                <span className="text-blue-200 truncate">
                  · {activeEventAlert.event.location}
                </span>
              ) : null}
              {activeEventAlert.actionOutcome ? (
                <span className="font-mono text-emerald-300 truncate">
                  · {activeEventAlert.actionOutcome}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={dismissEventAlert}
              aria-label={t.chat.dismiss}
              className="p-1 text-blue-200 hover:text-white shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <main className="flex-1 min-h-0 overflow-hidden">
          {activeSection === 'assistant' ? (
            <AssistantWorkspace
              conversations={store.conversations}
              activeConversation={activeConversation}
              draft={draft}
              onDraftChange={setDraft}
              onSelectConversation={(id) => {
                setActiveConversationId(id);
                setChatError(null);
              }}
              onNewConversation={() => void handleNewConversation()}
              onDeleteConversation={handleDeleteConversation}
              onSendMessage={handleSendMessage}
              isSending={isSending}
              sendingStatusText={sendingStatusText}
              isOnline={store.isOnline}
              errorMessage={chatError}
              onClearError={() => setChatError(null)}
              readiness={store.readiness}
              modules={
                store.modules.length > 0 ? store.modules : DEFAULT_OFFLINE_MODULES
              }
              onNavigateSection={setActiveSection}
              computerMounts={computerFs.mounts}
              computerFsSupported={computerFs.isSupported}
              onConnectFolder={computerFs.connectFolder}
              onReauthorizeFolder={computerFs.reauthorizeMount}
              googleWorkspaceConnected={Boolean(googleAccessToken) || isWorkspaceRemembered}
              authUserSignedIn={authStatus === 'authenticated'}
              onConnectGoogleWorkspace={connectGoogleWorkspace}
            />
          ) : activeSection === 'tasks' ? (
            <TasksView
              tasks={store.tasks}
              onCreateTask={store.createTask}
              onUpdateTaskStatus={store.updateTaskStatus}
              onUpdateTask={store.updateTask}
              onDeleteTask={store.deleteTask}
              reminders={extended.reminders}
              onCreateReminder={extended.createReminder}
              onCompleteReminder={extended.completeReminder}
              onDeleteReminder={extended.deleteReminder}
              events={store.events}
              onCreateDocument={store.createDocument}
              onDraftInAssistant={handleDraftInAssistant}
            />
          ) : activeSection === 'calendar' ? (
            <CalendarView
              events={store.events}
              isOnline={store.isOnline}
              onCreateEvent={store.createEvent}
              onDeleteEvent={store.deleteEvent}
              scheduledActions={extended.scheduledEventActions}
              onSetScheduledAction={extended.setEventScheduledAction}
              onRemoveScheduledAction={extended.removeEventScheduledAction}
              onDraftInAssistant={handleDraftInAssistant}
              onLogActivity={extended.logActivity}
            />
          ) : activeSection === 'files' ? (
            <FilesView
              documents={store.documents}
              onCreateDocument={store.createDocument}
              onToggleOffline={store.toggleDocumentOffline}
              onDeleteDocument={store.deleteDocument}
              onDraftInAssistant={handleDraftInAssistant}
              computerMounts={computerFs.mounts}
              computerFsSupported={computerFs.isSupported}
              computerMountError={computerFs.mountError}
              onClearMountError={computerFs.clearMountError}
              onConnectFolder={computerFs.connectFolder}
              onReauthorizeFolder={computerFs.reauthorizeMount}
              onDisconnectFolder={computerFs.disconnectMount}
              onRefreshMounts={computerFs.refreshMounts}
              workspaceSnapshot={getFullWorkspaceSnapshot()}
              onCreateVerifiedBackup={extended.createVerifiedBackup}
              onRestoreBackupSnapshot={handleRestoreBackupSnapshot}
              clipboardHistory={extended.clipboardHistory}
              onSaveClipboardEntry={extended.saveClipboardEntry}
              onTogglePinClipboard={extended.togglePinClipboard}
              onDeleteClipboardEntry={extended.deleteClipboardEntry}
            />
          ) : activeSection === 'emails' ? (
            <EmailsView
              isOnline={store.isOnline}
              cachedEmails={extended.cachedEmails}
              onUpdateCachedEmails={extended.setCachedEmails}
              dailySummaries={extended.dailyEmailSummaries}
              onSaveDailySummary={extended.upsertDailyEmailSummary}
              onClearCachedMailbox={extended.clearCachedMailbox}
              onDraftInAssistant={handleDraftInAssistant}
              onLogActivity={extended.logActivity}
              onNotifyCorner={pushCornerNotification}
            />
          ) : activeSection === 'memory' ? (
            <MemoryView
              memories={store.memories}
              onCreateMemory={store.createMemory}
              onDeleteMemory={store.deleteMemory}
              onDraftInAssistant={handleDraftInAssistant}
            />
          ) : activeSection === 'automations' ? (
            <AutomationsView
              automations={store.automations}
              onCreateAutomation={store.createAutomation}
              onToggleAutomation={store.toggleAutomation}
              onDeleteAutomation={store.deleteAutomation}
              onRunAutomation={handleRunAutomation}
              onDraftInAssistant={handleDraftInAssistant}
            />
          ) : activeSection === 'research' ? (
            <ResearchWebView
              isOnline={store.isOnline}
              downloads={extended.downloads}
              onAddDownloadRecord={extended.addDownloadRecord}
              authorizedApps={extended.authorizedApps}
              onAddAuthorizedApp={extended.addAuthorizedApp}
              onRemoveAuthorizedApp={extended.removeAuthorizedApp}
              onRestoreRecommendedApps={extended.restoreRecommendedApps}
              computerMounts={computerFs.mounts}
              onConnectFolder={computerFs.connectFolder}
              onLogActivity={extended.logActivity}
              onDraftInAssistant={handleDraftInAssistant}
            />
          ) : activeSection === 'workbench' ? (
            <DevWorkbenchView
              computerMounts={computerFs.mounts}
              onRefreshMounts={computerFs.refreshMounts}
              dataTables={extended.dataTables}
              onCreateDataTable={extended.createDataTable}
              onInsertTableRow={extended.insertTableRow}
              onDeleteTableRow={extended.deleteTableRow}
              onDeleteDataTable={extended.deleteDataTable}
              onDraftInAssistant={handleDraftInAssistant}
              onLogActivity={extended.logActivity}
            />
          ) : activeSection === 'hub' ? (
            <HubView
              isOnline={store.isOnline}
              onCreateTask={store.createTask}
              onCreateDocument={store.createDocument}
              financialEntries={extended.financialEntries}
              onAddFinancialEntry={extended.addFinancialEntry}
              onDeleteFinancialEntry={extended.deleteFinancialEntry}
              budgetTargets={extended.budgetTargets}
              onSetBudgetTarget={extended.setBudgetTarget}
              onDeleteBudgetTarget={extended.deleteBudgetTarget}
              onDraftInAssistant={handleDraftInAssistant}
              activityLogs={extended.activityLogs}
              onVaultLockChange={setVaultUnlocked}
              onLogActivity={extended.logActivity}
            />
          ) : (
            <SettingsView
              readiness={store.readiness}
              modules={
                store.modules.length > 0 ? store.modules : DEFAULT_OFFLINE_MODULES
              }
              isOnline={store.isOnline}
              pendingCount={store.pendingCount}
              conflictCount={store.conflictCount}
              isSyncing={store.isSyncing}
              lastSyncedAt={store.lastSyncedAt}
              syncError={store.syncError}
              onSyncNow={() => void store.syncPendingChanges()}
              connectedFoldersCount={
                computerFs.mounts.filter((m) => m.permission === 'granted').length
              }
              vaultUnlocked={vaultUnlocked}
            />
          )}
        </main>
      </div>

      {pendingDeletePaths ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-black/65 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-red-200 dark:border-red-500/35 bg-white dark:bg-[#0D1B36] p-5 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.chat.deleteConfirmTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.chat.deleteConfirmBody}
            </p>
            <ul className="p-3 rounded-lg bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-500/30 space-y-1 max-h-40 overflow-y-auto">
              {pendingDeletePaths.map((p) => (
                <li
                  key={p}
                  className="font-mono text-xs text-red-900 dark:text-red-200 break-all"
                >
                  {p}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveDeletePrompt(false)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-blue-400/20 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13254A]"
              >
                {t.chat.deleteConfirmCancel}
              </button>
              <button
                type="button"
                onClick={() => resolveDeletePrompt(true)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg bg-red-700 text-white hover:bg-red-800"
              >
                {t.chat.deleteConfirmProceed}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingSendEmail ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-black/65 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-blue-900/20 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] p-5 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.emails.sendConfirmTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.emails.sendConfirmBody}
            </p>
            <div className="p-3 rounded-lg bg-[#F8FAFD] dark:bg-[#08132A] border border-blue-900/15 dark:border-blue-400/20 space-y-1.5 text-xs">
              <p>
                <span className="font-semibold text-[#102A5C] dark:text-blue-300">
                  {t.emails.toLabel}:{' '}
                </span>
                <span className="font-mono dark:text-slate-200">{pendingSendEmail.to}</span>
              </p>
              <p dir="auto">
                <span className="font-semibold text-[#102A5C] dark:text-blue-300">
                  {t.emails.subjectLabel}:{' '}
                </span>
                <span className="dark:text-slate-200">{pendingSendEmail.subject}</span>
              </p>
              <p
                dir="auto"
                className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto pt-1 border-t border-blue-900/10 dark:border-blue-400/15"
              >
                {pendingSendEmail.body}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveSendEmailPrompt(false)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-blue-400/20 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#13254A]"
              >
                {t.emails.sendConfirmCancel}
              </button>
              <button
                type="button"
                onClick={() => resolveSendEmailPrompt(true)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500"
              >
                {t.emails.sendConfirmProceed}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CornerNotificationStack
        items={cornerNotifications}
        onDismiss={dismissCornerNotification}
        onOpenSection={setActiveSection}
      />

      <DesignersModal
        open={designersOpen}
        onClose={() => setDesignersOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AssistantShell />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
