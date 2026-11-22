import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  FilePlus,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useLanguage } from '../../i18n/languageContext';
import type {
  CalendarEvent,
  ReminderItem,
  ReminderRecurrence,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../../types/assistant';

interface TasksViewProps {
  tasks: TaskItem[];
  onCreateTask: (input: {
    title: string;
    priority: TaskPriority;
    dueDate?: string;
  }) => Promise<unknown>;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  onUpdateTask: (
    id: string,
    input: {
      title: string;
      priority: TaskPriority;
      dueDate?: string;
    }
  ) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  reminders: ReminderItem[];
  onCreateReminder: (input: {
    title: string;
    dueAt: string;
    recurrence?: ReminderRecurrence;
  }) => unknown;
  onCompleteReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  events: CalendarEvent[];
  onCreateDocument: (input: {
    title: string;
    content: string;
    folder: string;
  }) => Promise<unknown>;
  onDraftInAssistant: (prompt: string) => void;
}

type TasksTab = 'tasks' | 'reminders' | 'scheduler';

export function TasksView({
  tasks,
  onCreateTask,
  onUpdateTaskStatus,
  onUpdateTask,
  onDeleteTask,
  reminders,
  onCreateReminder,
  onCompleteReminder,
  onDeleteReminder,
  events,
  onCreateDocument,
  onDraftInAssistant,
}: TasksViewProps) {
  const { t, formatDateTime, formatNumber } = useLanguage();
  const [activeTab, setActiveTab] = useState<TasksTab>('tasks');

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  // Reminders state
  const [remTitle, setRemTitle] = useState('');
  const [remDueAt, setRemDueAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [remRecurrence, setRemRecurrence] = useState<ReminderRecurrence>('none');

  // Smart Scheduler state
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [planSavedNotice, setPlanSavedNotice] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateTask({
      title: title.trim(),
      priority,
      dueDate: dueDate.trim() || undefined,
    });
    setTitle('');
    setDueDate('');
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filter === 'open' && task.status === 'completed') return false;
      if (filter === 'completed' && task.status !== 'completed') return false;
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        (task.originalText ?? '').toLowerCase().includes(q)
      );
    });
  }, [tasks, filter, search]);

  const priorityLabel = (p: TaskPriority) =>
    p === 'high'
      ? t.tasks.priorityHigh
      : p === 'low'
      ? t.tasks.priorityLow
      : t.tasks.priorityMedium;

  const statusLabel = (s: TaskStatus) =>
    s === 'completed'
      ? t.tasks.statusCompleted
      : s === 'in_progress'
      ? t.tasks.statusInProgress
      : t.tasks.statusTodo;

  return (
    <div className="h-full overflow-y-auto bg-[#F8FAFD] dark:bg-[#071126] px-4 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1E3A8A]/80 dark:text-blue-300/80">{t.tasks.kicker}</p>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0B1B3B] dark:text-slate-100">
              {t.tasks.title}
            </h2>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t.tasks.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDraftInAssistant(t.tasks.askAssistantPrompt)}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>{t.tasks.askAssistant}</span>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </section>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#0D1B36] border border-blue-900/10 dark:border-blue-400/20">
          {(
            [
              ['tasks', t.extras.tabTasksList],
              ['reminders', t.extras.tabReminders],
              ['scheduler', t.extras.tabScheduler],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'bg-white dark:bg-[#162F61] text-[#0B1B3B] dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'tasks' ? (
          <>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.tasks.addPlaceholder}
              className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {t.tasks.addButton}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>{t.tasks.priorityLabel}:</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="min-h-[36px] px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-xs text-[#0B1B3B] dark:text-slate-100"
              >
                <option value="low" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityLow}</option>
                <option value="medium" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityMedium}</option>
                <option value="high" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityHigh}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>{t.tasks.dueDateLabel}:</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-xs text-[#0B1B3B] dark:text-slate-100 font-mono"
              />
            </label>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EAF0FA] dark:bg-[#0D1B36] border border-blue-900/10 dark:border-blue-400/20 self-start">
            {(
              [
                ['all', t.tasks.filterAll],
                ['open', t.tasks.filterOpen],
                ['completed', t.tasks.filterCompleted],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === key
                    ? 'bg-white dark:bg-[#162F61] text-[#0B1B3B] dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0B1B3B] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              dir="auto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.tasks.searchPlaceholder}
              className="w-full min-h-[40px] ps-9 pe-3 py-2 text-sm rounded-lg border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              {formatNumber(filteredTasks.length)} {t.tasks.title}
            </span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center space-y-1.5">
              <p className="text-sm font-semibold text-[#0B1B3B] dark:text-slate-100">{t.tasks.emptyTitle}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{t.tasks.emptySubtitle}</p>
            </div>
          ) : (
            <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl overflow-hidden">
              {filteredTasks.map((task) => {
                const isDone = task.status === 'completed';
                const isEditing = editingId === task.id;
                return (
                  <li
                    key={task.id}
                    className="p-4 flex flex-col gap-3 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/50 transition-colors"
                  >
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!editTitle.trim()) return;
                          void onUpdateTask(task.id, {
                            title: editTitle.trim(),
                            priority: editPriority,
                            dueDate: editDueDate.trim() || undefined,
                          });
                          setEditingId(null);
                        }}
                        className="space-y-3"
                      >
                        <input
                          type="text"
                          dir="auto"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-1.5 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <select
                              value={editPriority}
                              onChange={(e) =>
                                setEditPriority(e.target.value as TaskPriority)
                              }
                              className="min-h-[36px] px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#09142B] text-xs text-[#0B1B3B] dark:text-slate-100"
                            >
                              <option value="low" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityLow}</option>
                              <option value="medium" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityMedium}</option>
                              <option value="high" className="bg-white dark:bg-[#0D1B36]">{t.tasks.priorityHigh}</option>
                            </select>
                            <input
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              className="min-h-[36px] px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#09142B] text-xs text-[#0B1B3B] dark:text-slate-100 font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={!editTitle.trim()}
                              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{t.tasks.saveEdit}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 text-slate-700 dark:text-slate-200 bg-white dark:bg-[#09142B] hover:bg-slate-50 dark:hover:bg-[#132852]"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{t.tasks.cancelEdit}</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p
                            dir="auto"
                            className={`text-sm font-medium break-words ${
                              isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-[#0B1B3B] dark:text-slate-100'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{statusLabel(task.status)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {t.tasks.priorityLabel}: {priorityLabel(task.priority)}
                            </span>
                            {task.dueDate ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {task.dueDate}
                                </span>
                              </>
                            ) : null}
                            <span aria-hidden="true">·</span>
                            <span>
                              {t.tasks.sourceLabel}:{' '}
                              {task.sourceLanguage === 'fa' ? 'فارسی' : 'English'}
                            </span>
                          </div>
                          {task.originalText && task.originalText !== task.title ? (
                            <p dir="auto" className="text-xs text-slate-500 dark:text-slate-400">
                              {t.tasks.originalTextLabel}: {task.originalText}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateTaskStatus(
                                task.id,
                                isDone ? 'todo' : 'completed'
                              )
                            }
                            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568] whitespace-nowrap"
                          >
                            {isDone ? (
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <span>{isDone ? t.tasks.reopen : t.tasks.markDone}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(task.id);
                              setEditTitle(task.title);
                              setEditPriority(task.priority);
                              setEditDueDate(task.dueDate ?? '');
                            }}
                            aria-label={t.tasks.editTask}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-blue-900/20 dark:border-blue-400/25 text-[#102A5C] dark:text-blue-300 bg-white dark:bg-[#09142B] hover:bg-[#F3F6FB] dark:hover:bg-[#132852]"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteTask(task.id)}
                            aria-label={t.tasks.deleteTask}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
          </>
        ) : null}

        {activeTab === 'reminders' ? (
          <section className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!remTitle.trim() || !remDueAt) return;
                onCreateReminder({
                  title: remTitle.trim(),
                  dueAt: remDueAt,
                  recurrence: remRecurrence,
                });
                setRemTitle('');
              }}
              className="p-4 sm:p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] space-y-3"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  dir="auto"
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  placeholder={t.extras.reminderTitlePlaceholder}
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-[#0B1B3B] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0B1834] focus:border-[#102A5C] dark:focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!remTitle.trim() || !remDueAt}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#102A5C] dark:bg-blue-600 hover:bg-[#0B1D42] dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 rounded-lg whitespace-nowrap"
                >
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  <span>{t.extras.addReminderButton}</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="datetime-local"
                  value={remDueAt}
                  onChange={(e) => setRemDueAt(e.target.value)}
                  className="min-h-[36px] px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-xs font-mono text-[#0B1B3B] dark:text-slate-100"
                />
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>{t.extras.reminderRecurrenceLabel}:</span>
                  <select
                    value={remRecurrence}
                    onChange={(e) =>
                      setRemRecurrence(e.target.value as ReminderRecurrence)
                    }
                    className="min-h-[36px] px-2.5 py-1 rounded-md border border-blue-900/20 dark:border-blue-400/25 bg-[#F8FAFD] dark:bg-[#09142B] text-xs text-[#0B1B3B] dark:text-slate-100"
                  >
                    <option value="none" className="bg-white dark:bg-[#0D1B36]">{t.extras.recurrenceNone}</option>
                    <option value="daily" className="bg-white dark:bg-[#0D1B36]">{t.extras.recurrenceDaily}</option>
                    <option value="weekly" className="bg-white dark:bg-[#0D1B36]">{t.extras.recurrenceWeekly}</option>
                    <option value="monthly" className="bg-white dark:bg-[#0D1B36]">{t.extras.recurrenceMonthly}</option>
                  </select>
                </label>
              </div>
            </form>

            {reminders.length === 0 ? (
              <div className="p-8 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-center text-xs text-slate-500 dark:text-slate-400">
                —
              </div>
            ) : (
              <ul className="divide-y divide-blue-950/10 dark:divide-blue-400/15 border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] rounded-xl overflow-hidden">
                {reminders.map((rem) => (
                  <li
                    key={rem.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFD] dark:hover:bg-[#132852]/50"
                  >
                    <div className="min-w-0 space-y-1">
                      <p
                        dir="auto"
                        className={`text-sm font-medium ${
                          rem.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-[#0B1B3B] dark:text-slate-100'
                        }`}
                      >
                        {rem.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        <span>{formatDateTime(rem.dueAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {rem.recurrence === 'daily'
                            ? t.extras.recurrenceDaily
                            : rem.recurrence === 'weekly'
                              ? t.extras.recurrenceWeekly
                              : rem.recurrence === 'monthly'
                                ? t.extras.recurrenceMonthly
                                : t.extras.recurrenceNone}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onCompleteReminder(rem.id)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 text-[#102A5C] dark:text-blue-200 bg-[#F3F6FB] dark:bg-[#132852] hover:bg-[#E7EEF8] dark:hover:bg-[#1A3568]"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{rem.completed ? t.tasks.reopen : t.tasks.markDone}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(rem.id)}
                        aria-label={t.tasks.deleteTask}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {activeTab === 'scheduler' ? (
          <section className="space-y-5">
            <div className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-semibold text-sm text-[#0B1B3B] dark:text-slate-100">
                  {t.extras.tabScheduler}
                </p>
                <p className="font-mono tabular-nums">
                  {formatNumber(tasks.filter((x) => x.status !== 'completed').length)} open tasks ·{' '}
                  {formatNumber(events.length)} events · {formatNumber(reminders.filter((r) => !r.completed).length)} reminders
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlanSavedNotice(false);
                    const open = [...tasks]
                      .filter((x) => x.status !== 'completed')
                      .sort((a, b) => {
                        const rank = { high: 0, medium: 1, low: 2 };
                        return rank[a.priority] - rank[b.priority];
                      });
                    const high = open.filter((x) => x.priority === 'high');
                    const med = open.filter((x) => x.priority === 'medium');
                    const low = open.filter((x) => x.priority === 'low');
                    const activeRem = reminders.filter((r) => !r.completed).slice(0, 5);
                    const lines = [
                      `# Daily Productivity Plan — ${new Date().toISOString().slice(0, 10)}`,
                      '',
                      '## 08:30 – 11:30 · Deep Focus Block (High Priority)',
                      high.length > 0
                        ? high.map((x) => `- [ ] ${x.title}${x.dueDate ? ` (Due: ${x.dueDate})` : ''}`).join('\n')
                        : '- No high-priority tasks queued.',
                      '',
                      '## 11:30 – 14:30 · Calendar & Coordination',
                      events.length > 0
                        ? events.slice(0, 5).map((ev) => `- ${ev.startTime} — ${ev.title}${ev.location ? ` (${ev.location})` : ''}`).join('\n')
                        : '- No calendar events.',
                      '',
                      '## 14:30 – 17:30 · Core Execution (Medium Priority)',
                      med.length > 0
                        ? med.map((x) => `- [ ] ${x.title}${x.dueDate ? ` (Due: ${x.dueDate})` : ''}`).join('\n')
                        : '- No medium-priority tasks.',
                      '',
                      '## End-of-Day Quick Wins & Reminders',
                      ...low.map((x) => `- [ ] ${x.title}`),
                      ...activeRem.map((r) => `- Reminder (${r.dueAt}): ${r.title}`),
                    ].join('\n');
                    setGeneratedPlan(lines);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#102A5C] dark:bg-blue-600 text-white hover:bg-[#0B1D42] dark:hover:bg-blue-500"
                >
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  <span>{t.extras.generatePlanButton}</span>
                </button>
                {generatedPlan ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await onCreateDocument({
                        title: `Daily Plan ${new Date().toISOString().slice(0, 10)}`,
                        folder: 'Plans',
                        content: generatedPlan,
                      });
                      setPlanSavedNotice(true);
                    }}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-blue-900/20 dark:border-blue-400/25 bg-white dark:bg-[#09142B] text-[#102A5C] dark:text-blue-200 hover:bg-[#EAF0FA] dark:hover:bg-[#132852]"
                  >
                    <FilePlus className="h-4 w-4" aria-hidden="true" />
                    <span>{t.extras.savePlanDocButton}</span>
                  </button>
                ) : null}
              </div>
            </div>

            {planSavedNotice ? (
              <div className="p-3 rounded-xl border border-blue-900/15 dark:border-blue-400/25 bg-[#EAF0FA] dark:bg-[#132852] text-xs font-medium text-[#102A5C] dark:text-blue-200">
                Saved to Files (Plans).
              </div>
            ) : null}

            {generatedPlan ? (
              <pre
                dir="auto"
                className="p-5 rounded-xl border border-blue-900/15 dark:border-blue-400/20 bg-white dark:bg-[#0D1B36] text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans"
              >
                {generatedPlan}
              </pre>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
