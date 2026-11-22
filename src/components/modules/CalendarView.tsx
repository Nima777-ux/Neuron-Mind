import {
  ArrowRight,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import { GOOGLE_CLOUD_PROJECT_NUMBER } from '../../lib/firebase/firebase';
import { useAuth } from '../../lib/firebase/authContext';
import {
  WorkspaceApiDisabledError,
  WorkspaceAuthExpiredError,
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '../../services/workspaceGoogleApi';
import type {
  ActivityLogEntry,
  CalendarEvent,
  ScheduledActionType,
  ScheduledEventAction,
  TaskPriority,
} from '../../types/assistant';

interface CalendarViewProps {
  events: CalendarEvent[];
  isOnline: boolean;
  onCreateEvent: (input: {
    title: string;
    startTime: string;
    location?: string;
  }) => Promise<CalendarEvent | unknown>;
  onDeleteEvent: (id: string) => Promise<void>;
  scheduledActions?: ScheduledEventAction[];
  onSetScheduledAction?: (action: ScheduledEventAction) => void;
  onRemoveScheduledAction?: (eventId: string) => void;
  onDraftInAssistant: (prompt: string) => void;
  onLogActivity: (entry: Omit<ActivityLogEntry, 'id' | 'createdAt'>) => void;
}

function formatLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function CalendarView({
  events,
  isOnline,
  onCreateEvent,
  onDeleteEvent,
  scheduledActions = [],
  onSetScheduledAction,
  onRemoveScheduledAction,
  onDraftInAssistant,
  onLogActivity,
}: CalendarViewProps) {
  const { t, formatDateTime, language } = useLanguage();
  const {
    googleAccessToken,
    authError,
    clearAuthError,
    connectGoogleWorkspace,
    clearGoogleAccessToken,
  } = useAuth();

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [pushToGoogle, setPushToGoogle] = useState(false);

  // Optional Scheduled Action at Event Time
  const [actionType, setActionType] = useState<ScheduledActionType>('none');
  const [actionValue, setActionValue] = useState('');
  const [actionExtra, setActionExtra] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [formError, setFormError] = useState<string | null>(null);

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [apiDisabledInfo, setApiDisabledInfo] = useState<{
    gmailEnableUrl: string;
    calendarEnableUrl: string;
  } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleSetOneMinFromNow = () => {
    const dt = new Date(Date.now() + 65 * 1000);
    setStartTime(formatLocalDatetimeInput(dt));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !startTime.trim()) return;
    const cleanTitle = title.trim();
    const cleanStart = startTime.trim();
    const cleanLoc = location.trim() || undefined;
    const cleanVal = actionValue.trim();

    if (actionType === 'download_url') {
      if (!/^https?:\/\/\S+/i.test(cleanVal)) {
        setFormError(
          language === 'fa'
            ? 'لطفاً یک لینک معتبر با http:// یا https:// برای دانلود خودکار وارد کنید.'
            : 'Please enter a valid https:// URL for the scheduled download action.'
        );
        return;
      }
    }

    const created = await onCreateEvent({
      title: cleanTitle,
      startTime: cleanStart,
      location: cleanLoc,
    });

    if (
      created &&
      typeof created === 'object' &&
      'id' in created &&
      typeof (created as CalendarEvent).id === 'string' &&
      onSetScheduledAction
    ) {
      const eventId = (created as CalendarEvent).id;
      const sanitizedFolder =
        cleanVal ||
        `Meetings/${cleanTitle.replace(/[^\w\s-]/g, '').trim() || 'Event'}`;

      onSetScheduledAction({
        eventId,
        eventTitle: cleanTitle,
        startTime: cleanStart,
        location: cleanLoc,
        actionType,
        folderPath: actionType === 'create_folder' ? sanitizedFolder : undefined,
        url: actionType === 'download_url' ? cleanVal : undefined,
        taskTitle: actionType === 'create_task' ? cleanVal || cleanTitle : undefined,
        taskPriority: actionType === 'create_task' ? taskPriority : undefined,
        docTitle: actionType === 'create_document' ? cleanVal || cleanTitle : undefined,
        docContent:
          actionType === 'create_document'
            ? actionExtra.trim() || `Scheduled note for calendar event: ${cleanTitle}`
            : undefined,
        actionStatus: 'pending',
      });
    }

    if (pushToGoogle && googleAccessToken && isOnline) {
      try {
        setApiDisabledInfo(null);
        await createGoogleCalendarEvent({
          accessToken: googleAccessToken,
          title: cleanTitle,
          startTime: cleanStart,
          location: cleanLoc,
        });
        onLogActivity({
          category: 'agent',
          title: `Created Google Calendar event: ${cleanTitle}`,
          details: cleanStart,
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
        setGoogleError(
          err instanceof Error ? err.message : 'Unable to push event to Google Calendar.'
        );
      }
    }

    setTitle('');
    setStartTime('');
    setLocation('');
    setActionType('none');
    setActionValue('');
    setActionExtra('');
  };

  const handleSyncFromGoogle = async () => {
    if (!googleAccessToken || !isOnline) return;
    setSyncingGoogle(true);
    setGoogleError(null);
    setGoogleNotice(null);
    setApiDisabledInfo(null);
    try {
      const remoteEvents = await listGoogleCalendarEvents({
        accessToken: googleAccessToken,
        maxResults: 20,
      });

      const existingKeys = new Set(
        events.map((ev) => `${ev.title.toLowerCase()}::${ev.startTime.slice(0, 16)}`)
      );
      let imported = 0;
      for (const remote of remoteEvents) {
        const key = `${remote.title.toLowerCase()}::${remote.startTime.slice(0, 16)}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          await onCreateEvent({
            title: remote.title,
            startTime: remote.startTime,
            location: remote.location,
          });
          imported += 1;
        }
      }
      setGoogleNotice(`${t.calendar.googlePullSuccess} (${imported})`);
      onLogActivity({
        category: 'system',
        title: `Google Calendar synced (${imported} new events)`,
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
      setGoogleError(
        err instanceof Error ? err.message : 'Unable to sync Google Calendar.'
      );
    } finally {
      setSyncingGoogle(false);
    }
  };

  const describeScheduledAction = (act: ScheduledEventAction): string => {
    if (act.actionType === 'none') {
      return t.calendar.actionNone;
    }
    if (act.actionType === 'create_folder') {
      return `${t.calendar.actionCreateFolder}: ${act.folderPath ?? ''}`;
    }
    if (act.actionType === 'download_url') {
      return `${t.calendar.actionDownloadUrl}: ${act.url ?? ''}`;
    }
    if (act.actionType === 'create_task') {
      return `${t.calendar.actionCreateTask}: ${act.taskTitle ?? ''}`;
    }
    if (act.actionType === 'create_document') {
      return `${t.calendar.actionCreateDocument}: ${act.docTitle ?? ''}`;
    }
    return '';
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.calendar.kicker}</p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
              {t.calendar.title}
            </h2>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t.calendar.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {googleAccessToken ? (
              <button
                type="button"
                disabled={syncingGoogle || !isOnline}
                onClick={() => void handleSyncFromGoogle()}
                className="min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#102A5C] dark:text-blue-200 bg-white dark:bg-[#0D1B36] border border-blue-900/20 dark:border-blue-400/25 hover:bg-[#EAF0FA] dark:hover:bg-[#132852] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncingGoogle ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>
                  {syncingGoogle ? t.calendar.syncingGoogle : t.calendar.pullGoogleEvents}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => {
                  setGoogleError(null);
                  void connectGoogleWorkspace().catch((err) => {
                    if (err instanceof Error && !authError) {
                      setGoogleError(err.message);
                    }
                  });
                }}
                className="min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#1F1F1F] dark:text-slate-100 bg-white dark:bg-[#0D1B36] border border-[#747775]/45 dark:border-blue-400/30 hover:bg-slate-50 dark:hover:bg-[#132852] disabled:opacity-50 rounded-lg shadow-xs transition-colors whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{t.calendar.connectGoogleCalendar}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onDraftInAssistant(t.calendar.askAssistantPrompt)}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>{t.calendar.askAssistant}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </section>

        {apiDisabledInfo ? (
          <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/45 space-y-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
            <p className="font-semibold">{t.emails.apiDisabledTitle}</p>
            <p className="leading-relaxed opacity-90">{t.emails.apiDisabledBody}</p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={apiDisabledInfo.calendarEnableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#102A5C] text-white text-xs font-medium hover:bg-[#0B1D42]"
              >
                <span>{t.emails.enableCalendarApi}</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href={`https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${GOOGLE_CLOUD_PROJECT_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1B36] border border-amber-400/50 text-[#0B1B3B] dark:text-slate-100 text-xs font-medium hover:bg-amber-100/60"
              >
                <span>{t.emails.enableGmailApi}</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => void handleSyncFromGoogle()}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.emails.retryConnection}</span>
              </button>
            </div>
          </div>
        ) : null}

        {googleError || authError ? (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/35 bg-red-50 dark:bg-red-950/45 text-xs text-red-900 dark:text-red-200 flex items-center justify-between gap-2">
            <span>{googleError ?? authError}</span>
            <button
              type="button"
              onClick={() => {
                setGoogleError(null);
                clearAuthError();
              }}
              className="font-medium underline shrink-0"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : null}

        {googleNotice ? (
          <div className="p-3 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] text-xs text-[#102A5C] dark:text-blue-200 flex items-center justify-between gap-2">
            <span>{googleNotice}</span>
            <button
              type="button"
              onClick={() => setGoogleNotice(null)}
              className="font-medium underline"
            >
              {t.chat.dismiss}
            </button>
          </div>
        ) : null}

        {!googleAccessToken ? (
          <section className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA]/60 dark:bg-[#132852] space-y-2.5">
            <h3 className="text-xs sm:text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.emails.nextStepsTitle}
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-baseline gap-2">
                <span className="font-mono text-[#1E3A8A]/75 dark:text-blue-300/80 shrink-0">01.</span>
                <span>{t.emails.step1}</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="font-mono text-[#1E3A8A]/75 dark:text-blue-300/80 shrink-0">02.</span>
                <span>{t.emails.step2}</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="font-mono text-[#1E3A8A]/75 dark:text-blue-300/80 shrink-0">03.</span>
                <span>{t.emails.step3}</span>
              </li>
            </ul>
          </section>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.calendar.eventTitlePlaceholder}
              className="min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label={t.calendar.startTimeLabel}
                className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 font-mono focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSetOneMinFromNow}
                className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] hover:bg-blue-100 dark:hover:bg-[#1A3568] text-[#102A5C] dark:text-blue-200 whitespace-nowrap shrink-0"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.calendar.quickTestOneMin}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              dir="auto"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t.calendar.locationPlaceholder}
              className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!title.trim() || !startTime.trim()}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {t.calendar.addButton}
            </button>
          </div>

          {formError ? (
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">{formError}</p>
          ) : null}

          {onSetScheduledAction ? (
            <div className="pt-2 border-t border-blue-950/10 dark:border-blue-400/15 space-y-2">
              <label className="block text-xs font-medium text-[#102A5C] dark:text-blue-300">
                {t.calendar.scheduledActionLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={actionType}
                  onChange={(e) => {
                    setActionType(e.target.value as ScheduledActionType);
                    setActionValue('');
                    setActionExtra('');
                    setFormError(null);
                  }}
                  className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100"
                >
                  <option value="none" className="bg-white dark:bg-[#0D1B36]">{t.calendar.actionNone}</option>
                  <option value="create_folder" className="bg-white dark:bg-[#0D1B36]">{t.calendar.actionCreateFolder}</option>
                  <option value="download_url" className="bg-white dark:bg-[#0D1B36]">{t.calendar.actionDownloadUrl}</option>
                  <option value="create_task" className="bg-white dark:bg-[#0D1B36]">{t.calendar.actionCreateTask}</option>
                  <option value="create_document" className="bg-white dark:bg-[#0D1B36]">{t.calendar.actionCreateDocument}</option>
                </select>

                {actionType === 'create_folder' ? (
                  <input
                    type="text"
                    dir="ltr"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={t.calendar.actionFolderPlaceholder}
                    className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                ) : actionType === 'download_url' ? (
                  <input
                    type="url"
                    dir="ltr"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={t.calendar.actionUrlPlaceholder}
                    className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                ) : actionType === 'create_task' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="auto"
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder={t.calendar.actionTaskPlaceholder}
                      className="flex-1 min-h-[40px] px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                    />
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                      className="min-h-[40px] px-2.5 py-1.5 text-xs rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100"
                    >
                      <option value="low" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityLow}</option>
                      <option value="medium" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityMedium}</option>
                      <option value="high" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityHigh}</option>
                    </select>
                  </div>
                ) : actionType === 'create_document' ? (
                  <input
                    type="text"
                    dir="auto"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={t.calendar.actionDocPlaceholder}
                    className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                  />
                ) : null}
              </div>
              {actionType === 'create_document' ? (
                <input
                  type="text"
                  dir="auto"
                  value={actionExtra}
                  onChange={(e) => setActionExtra(e.target.value)}
                  placeholder={t.files.contentPlaceholder}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
              ) : null}
            </div>
          ) : null}

          {googleAccessToken ? (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={pushToGoogle}
                onChange={(e) => setPushToGoogle(e.target.checked)}
                className="h-4 w-4 rounded border-blue-900/30 dark:border-blue-400/40 text-[#102A5C] dark:accent-blue-500"
              />
              <span>{t.calendar.pushToGoogleLabel}</span>
            </label>
          ) : null}
        </form>

        {events.length === 0 ? (
          <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">{t.calendar.emptyTitle}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.calendar.emptySubtitle}</p>
          </div>
        ) : (
          <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl overflow-hidden">
            {events.map((ev) => {
              const linked = scheduledActions.find((a) => a.eventId === ev.id);
              return (
                <li
                  key={ev.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/50 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <p dir="auto" className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">
                      {ev.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                        <CalendarIcon className="h-3.5 w-3.5 text-[#102A5C] dark:text-blue-300" aria-hidden="true" />
                        {formatDateTime(ev.startTime)}
                      </span>
                      {ev.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                          <span dir="auto">{ev.location}</span>
                        </span>
                      ) : null}
                    </div>
                    {linked ? (
                      <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-[#102A5C] dark:text-blue-300 truncate max-w-md">
                          {describeScheduledAction(linked)}
                        </span>
                        <span
                          className={`font-semibold ${
                            linked.actionStatus === 'executed'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : linked.actionStatus === 'failed'
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          ·{' '}
                          {linked.actionStatus === 'executed'
                            ? t.calendar.actionStatusExecuted
                            : linked.actionStatus === 'failed'
                              ? t.calendar.actionStatusFailed
                              : t.calendar.actionStatusPending}
                        </span>
                        {linked.actionResult ? (
                          <span className="text-slate-500 dark:text-slate-400 font-mono truncate max-w-xs">
                            ({linked.actionResult})
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(ev.id)}
                    aria-label={t.calendar.deleteEvent}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pendingDeleteId ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-black/65 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-red-200 dark:border-red-500/35 bg-white dark:bg-[#0D1B36] p-5 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#0B1B3B] dark:text-slate-100">
              {t.calendar.googleDeleteConfirmTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.calendar.googleDeleteConfirmBody}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-blue-400/25 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#132852]"
              >
                {t.calendar.googleDeleteCancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = pendingDeleteId;
                  setPendingDeleteId(null);
                  onRemoveScheduledAction?.(id);
                  void onDeleteEvent(id);
                }}
                className="min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg bg-red-700 text-white hover:bg-red-800"
              >
                {t.calendar.googleDeleteProceed}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
