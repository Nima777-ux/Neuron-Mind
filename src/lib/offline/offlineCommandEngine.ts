import { detectTextLanguage } from '../../i18n/detectLanguage';
import {
  createComputerFolder,
  listComputerDirectory,
  readComputerFile,
  searchComputerFiles,
  writeComputerFile,
  type ComputerFolderMount,
} from '../platform/computerFiles';
import type {
  AppLanguage,
  AutomationRule,
  CalendarEvent,
  DocumentFile,
  MemoryCategory,
  MemoryItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
  WorkspaceSnapshot,
} from '../../types/assistant';

export const OFFLINE_ENGINE_MODEL = 'offline-local-engine';

export interface OfflineStoreActions {
  createTask: (input: {
    title: string;
    priority: TaskPriority;
    dueDate?: string;
    sourceLanguage?: AppLanguage;
  }) => Promise<TaskItem>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createEvent: (input: {
    title: string;
    startTime: string;
    location?: string;
    sourceLanguage?: AppLanguage;
  }) => Promise<CalendarEvent>;
  createDocument: (input: {
    title: string;
    content: string;
    folder: string;
    sourceLanguage?: AppLanguage;
  }) => Promise<DocumentFile>;
  createMemory: (input: {
    fact: string;
    category: MemoryCategory;
    sourceLanguage?: AppLanguage;
  }) => Promise<MemoryItem>;
  createAutomation: (input: {
    name: string;
    trigger: string;
    actionSummary: string;
    sourceLanguage?: AppLanguage;
  }) => Promise<AutomationRule>;
}

export interface OfflineCommandResult {
  reply: string;
  language: AppLanguage;
  toolActions: string[];
}

function getIsoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function extractPriority(text: string): {
  priority: TaskPriority;
  cleaned: string;
} {
  let priority: TaskPriority = 'medium';
  let cleaned = text;

  if (
    /\b(high priority|priority high|urgent|critical|asap)\b/i.test(cleaned) ||
    /(اولویت بالا|اولویت زیاد|خیلی مهم|فوری|زیاد)/u.test(cleaned)
  ) {
    priority = 'high';
    cleaned = cleaned
      .replace(/\b(with\s+)?(high priority|priority\s*:?\s*high|urgent|critical|asap)\b/gi, '')
      .replace(/(با\s*)?(اولویت بالا|اولویت زیاد|خیلی مهم|فوری)/gu, '');
  } else if (
    /\b(low priority|priority low)\b/i.test(cleaned) ||
    /(اولویت کم|اولویت پایین)/u.test(cleaned)
  ) {
    priority = 'low';
    cleaned = cleaned
      .replace(/\b(with\s+)?(low priority|priority\s*:?\s*low)\b/gi, '')
      .replace(/(با\s*)?(اولویت کم|اولویت پایین)/gu, '');
  }

  return { priority, cleaned: cleaned.replace(/\s+/g, ' ').trim() };
}

function extractDueDate(text: string): {
  dueDate?: string;
  cleaned: string;
} {
  let dueDate: string | undefined;
  let cleaned = text;

  const explicitIso = cleaned.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitIso) {
    dueDate = explicitIso[1];
    cleaned = cleaned.replace(explicitIso[0], '');
  } else if (/\b(today)\b/i.test(cleaned) || /(امروز)/u.test(cleaned)) {
    dueDate = getIsoDateOffset(0);
    cleaned = cleaned
      .replace(/\b(for\s+)?today\b/gi, '')
      .replace(/(برای\s*)?امروز/gu, '');
  } else if (/\b(tomorrow)\b/i.test(cleaned) || /(فردا)/u.test(cleaned)) {
    dueDate = getIsoDateOffset(1);
    cleaned = cleaned
      .replace(/\b(for\s+)?tomorrow\b/gi, '')
      .replace(/(برای\s*)?فردا/gu, '');
  }

  return { dueDate, cleaned: cleaned.replace(/\s+/g, ' ').trim() };
}

function findMatchingTask(tasks: TaskItem[], queryText: string): TaskItem | undefined {
  const q = queryText.trim().toLowerCase();
  if (!q) return undefined;
  return (
    tasks.find((t) => t.title.toLowerCase() === q) ??
    tasks.find(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        q.includes(t.title.toLowerCase())
    )
  );
}

export async function executeOfflineCommand(
  rawMessage: string,
  uiLanguage: AppLanguage,
  snapshot: WorkspaceSnapshot,
  actions: OfflineStoreActions,
  computerMounts: ComputerFolderMount[] = []
): Promise<OfflineCommandResult> {
  const message = rawMessage.trim();
  const lang = detectTextLanguage(message) || uiLanguage;
  const isFa = lang === 'fa';
  const toolActions: string[] = [];

  // 0a. Offline Computer Folder: List directory
  const listPcMatch =
    message.match(/^(?:list\s+(?:computer\s+)?(?:files|folder|directory)(?:\s+in)?)\s*[:\-]?\s*(.*)$/i) ??
    message.match(/^(?:لیست\s+(?:فایل‌های|پوشه)\s+کامپیوتر|نمایش\s+فایل‌های\s+کامپیوتر)\s*[:\-]?\s*(.*)$/u);
  if (listPcMatch) {
    const targetPath = (listPcMatch[1] ?? '').trim();
    try {
      const res = await listComputerDirectory(computerMounts, targetPath, false, 1);
      toolActions.push('offline:list_computer_directory');
      const lines =
        res.entries.length > 0
          ? res.entries
              .slice(0, 25)
              .map((e) => `${e.kind === 'directory' ? '[Folder]' : '[File]'} ${e.path}`)
              .join('\n')
          : isFa
            ? 'این پوشه خالی است.'
            : 'Folder is empty.';
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `محتوای پوشه کامپیوتر (${res.path}):\n\n${lines}`
          : `Computer folder contents (${res.path}):\n\n${lines}`,
      };
    } catch (err) {
      return {
        language: lang,
        toolActions,
        reply:
          err instanceof Error
            ? err.message
            : isFa
              ? 'هیچ پوشه‌ای از کامپیوتر متصل نیست.'
              : 'No connected computer folder found.',
      };
    }
  }

  // 0b. Offline Computer Folder: Create folder
  const mkdirMatch =
    message.match(/^(?:create|make|new)\s+(?:computer\s+)?(?:folder|directory)\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:ساخت|ایجاد)\s+پوشه(?:\s+در\s+کامپیوتر)?\s*[:\-]?\s*(.+)$/u);
  if (mkdirMatch?.[1]) {
    try {
      const res = await createComputerFolder(computerMounts, mkdirMatch[1].trim());
      toolActions.push('offline:create_computer_folder');
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `پوشه «${res.path}» مستقیماً روی کامپیوتر ایجاد شد.`
          : `Created folder "${res.path}" directly on your computer.`,
      };
    } catch (err) {
      return {
        language: lang,
        toolActions,
        reply: err instanceof Error ? err.message : 'Unable to create folder.',
      };
    }
  }

  // 0c. Offline Computer Folder: Read file
  const readPcMatch =
    message.match(/^(?:read|open|show)\s+(?:computer\s+)?file\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:خواندن|نمایش)\s+فایل(?:\s+کامپیوتر)?\s*[:\-]?\s*(.+)$/u);
  if (readPcMatch?.[1]) {
    try {
      const res = await readComputerFile(computerMounts, readPcMatch[1].trim());
      toolActions.push('offline:read_computer_file');
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `محتوای فایل ${res.path} (${res.size} بایت):\n\n${res.content.slice(0, 4000)}`
          : `Contents of ${res.path} (${res.size} bytes):\n\n${res.content.slice(0, 4000)}`,
      };
    } catch (err) {
      return {
        language: lang,
        toolActions,
        reply: err instanceof Error ? err.message : 'Unable to read file.',
      };
    }
  }

  // 0d. Offline Computer Folder: Write file ("write file path: content")
  const writePcMatch =
    message.match(/^(?:write|create|save)\s+(?:computer\s+)?file\s+([^\n:]+):\s*([\s\S]+)$/i) ??
    message.match(/^(?:ساخت|نوشتن|ذخیره)\s+فایل(?:\s+کامپیوتر)?\s+([^\n:]+):\s*([\s\S]+)$/u);
  if (writePcMatch?.[1] && writePcMatch?.[2]) {
    try {
      const res = await writeComputerFile(
        computerMounts,
        writePcMatch[1].trim(),
        writePcMatch[2].trim(),
        'overwrite'
      );
      toolActions.push('offline:write_computer_file');
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `فایل «${res.path}» (${res.bytesWritten} بایت) روی کامپیوتر ذخیره شد.`
          : `Saved "${res.path}" (${res.bytesWritten} bytes) to your computer.`,
      };
    } catch (err) {
      return {
        language: lang,
        toolActions,
        reply: err instanceof Error ? err.message : 'Unable to write file.',
      };
    }
  }

  // 0e. Offline Computer Folder: Search files
  const searchPcMatch =
    message.match(/^(?:search)\s+(?:computer\s+)?(?:files|folders)\s*(?:for)?\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:جستجوی|جستجو\s+در)\s+فایل‌های\s+کامپیوتر\s*[:\-]?\s*(.+)$/u);
  if (searchPcMatch?.[1]) {
    try {
      const res = await searchComputerFiles(computerMounts, searchPcMatch[1].trim(), '', true);
      toolActions.push('offline:search_computer_files');
      const lines =
        res.matches.length > 0
          ? res.matches
              .slice(0, 20)
              .map((m) => `- ${m.path}${m.snippet ? ` — "${m.snippet}"` : ''}`)
              .join('\n')
          : isFa
            ? 'موردی یافت نشد.'
            : 'No matching files found.';
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `نتایج جستجو برای «${res.query}»:\n\n${lines}`
          : `Computer file search results for "${res.query}":\n\n${lines}`,
      };
    } catch (err) {
      return {
        language: lang,
        toolActions,
        reply: err instanceof Error ? err.message : 'Search failed.',
      };
    }
  }

  // 1. Complete / Mark Done Task
  const completeMatch =
    message.match(/^(?:complete|finish|done|mark\s+done)\s+(?:task\s+)?[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:تکمیل|انجام\s+شد|انجام)\s+(?:وظیفه\s+|کار\s+)?[:\-]?\s*(.+)$/u);
  if (completeMatch?.[1]) {
    const query = completeMatch[1].trim();
    const target = findMatchingTask(snapshot.tasks, query);
    if (!target) {
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `در حالت آفلاین وظیفه‌ای با عنوان «${query}» پیدا نشد. می‌توانید از بخش وظایف لیست کامل را ببینید.`
          : `No cached task matching "${query}" was found offline. Open the Tasks view to inspect all cached items.`,
      };
    }
    await actions.updateTaskStatus(target.id, 'completed');
    toolActions.push('offline:update_task_status');
    return {
      language: lang,
      toolActions,
      reply: isFa
        ? `وظیفه «${target.title}» به‌صورت آفلاین تکمیل شد و در صف همگام‌سازی ذخیره گردید.`
        : `Completed task "${target.title}" offline and queued it for Firestore sync.`,
    };
  }

  // 2. Reopen Task
  const reopenMatch =
    message.match(/^(?:reopen)\s+(?:task\s+)?[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:بازگشایی)\s+(?:وظیفه\s+|کار\s+)?[:\-]?\s*(.+)$/u);
  if (reopenMatch?.[1]) {
    const query = reopenMatch[1].trim();
    const target = findMatchingTask(snapshot.tasks, query);
    if (target) {
      await actions.updateTaskStatus(target.id, 'todo');
      toolActions.push('offline:update_task_status');
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `وظیفه «${target.title}» دوباره باز شد.`
          : `Reopened task "${target.title}" offline.`,
      };
    }
  }

  // 3. Delete Task
  const deleteTaskMatch =
    message.match(/^(?:delete|remove)\s+(?:task)\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:حذف)\s+(?:وظیفه|کار)\s*[:\-]?\s*(.+)$/u);
  if (deleteTaskMatch?.[1]) {
    const query = deleteTaskMatch[1].trim();
    const target = findMatchingTask(snapshot.tasks, query);
    if (!target) {
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `وظیفه‌ای با نام «${query}» پیدا نشد.`
          : `Could not find a task matching "${query}".`,
      };
    }
    await actions.deleteTask(target.id);
    toolActions.push('offline:delete_task');
    return {
      language: lang,
      toolActions,
      reply: isFa
        ? `وظیفه «${target.title}» به‌صورت آفلاین حذف شد و در صف همگام‌سازی قرار گرفت.`
        : `Deleted task "${target.title}" offline and queued the change for sync.`,
    };
  }

  // 4. Create Task
  const createTaskMatch =
    message.match(
      /^(?:add\s+task|create\s+task|new\s+task|todo|remind\s+me\s+to)\s*[:\-]?\s*(.+)$/i
    ) ??
    message.match(
      /^(?:افزودن\s+وظیفه|ایجاد\s+وظیفه|وظیفه\s+جدید|وظیفه|کار\s+جدید|یادم\s+بنداز)\s*[:\-]?\s*(.+)$/u
    );
  if (createTaskMatch?.[1]) {
    const { priority, cleaned: noPriority } = extractPriority(createTaskMatch[1]);
    const { dueDate, cleaned: finalTitle } = extractDueDate(noPriority);
    const cleanTitle = finalTitle.replace(/(اضافه\s+کن|ثبت\s+کن|بساز)$/u, '').trim();
    if (cleanTitle) {
      const created = await actions.createTask({
        title: cleanTitle,
        priority,
        dueDate,
        sourceLanguage: lang,
      });
      toolActions.push('offline:create_task');
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `وظیفه «${created.title}» (اولویت: ${created.priority}${created.dueDate ? ` · سررسید: ${created.dueDate}` : ''}) به‌صورت آفلاین ثبت شد و پس از اتصال اینترنت همگام‌سازی می‌شود.`
          : `Created task "${created.title}" (priority: ${created.priority}${created.dueDate ? `, due: ${created.dueDate}` : ''}) offline. It will sync automatically once online.`,
      };
    }
  }

  // 5. Schedule Calendar Event
  const eventMatch =
    message.match(/^(?:schedule|add\s+event|create\s+event|new\s+event|meeting)\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:زمان‌بندی|رویداد\s+جدید|افزودن\s+رویداد|ثبت\s+رویداد|جلسه)\s*[:\-]?\s*(.+)$/u);
  if (eventMatch?.[1]) {
    const { dueDate, cleaned } = extractDueDate(eventMatch[1]);
    const timeMatch = cleaned.match(/\b(\d{1,2}:\d{2})\b/);
    const datePart = dueDate ?? getIsoDateOffset(0);
    const timePart = timeMatch ? timeMatch[1].padStart(5, '0') : '09:00';
    const eventTitle = cleaned
      .replace(timeMatch?.[0] ?? '', '')
      .replace(/\b(at|on)\b/gi, '')
      .replace(/(ساعت|ثبت\s+کن|اضافه\s+کن)/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (eventTitle) {
      const startTime = `${datePart}T${timePart}`;
      const ev = await actions.createEvent({
        title: eventTitle,
        startTime,
        sourceLanguage: lang,
      });
      toolActions.push('offline:create_event');
      return {
        language: lang,
        toolActions,
        reply: isFa
          ? `رویداد «${ev.title}» برای ${ev.startTime} به‌صورت آفلاین در تقویم ذخیره شد.`
          : `Scheduled offline calendar event "${ev.title}" at ${ev.startTime}.`,
      };
    }
  }

  // 6. Save Note / Document
  const docMatch =
    message.match(/^(?:save\s+note|create\s+note|add\s+note|new\s+note|create\s+file|save\s+document)\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:ذخیره\s+یادداشت|یادداشت\s+جدید|یادداشت|سند\s+جدید|ذخیره\s+سند)\s*[:\-]?\s*(.+)$/u);
  if (docMatch?.[1]) {
    const body = docMatch[1].trim();
    const titlePreview = body.slice(0, 60) + (body.length > 60 ? '...' : '');
    const docItem = await actions.createDocument({
      title: titlePreview,
      content: body,
      folder: isFa ? 'یادداشت‌های آفلاین' : 'Offline Notes',
      sourceLanguage: lang,
    });
    toolActions.push('offline:create_document');
    return {
      language: lang,
      toolActions,
      reply: isFa
        ? `یادداشت «${docItem.title}» در بخش فایل‌ها ذخیره و برای دسترسی آفلاین نگه داشته شد.`
        : `Saved document "${docItem.title}" to Files for offline access and future sync.`,
    };
  }

  // 7. Save Memory
  const memoryMatch =
    message.match(/^(?:remember(?:\s+that)?|save\s+memory)\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:به\s+خاطر\s+بسپار|یادت\s+باشه|ذخیره\s+حافظه)\s*[:\-]?\s*(.+)$/u);
  if (memoryMatch?.[1]) {
    const fact = memoryMatch[1].trim();
    const mem = await actions.createMemory({
      fact,
      category: 'context',
      sourceLanguage: lang,
    });
    toolActions.push('offline:create_memory');
    return {
      language: lang,
      toolActions,
      reply: isFa
        ? `در حافظه آفلاین ذخیره شد: «${mem.fact}».`
        : `Saved to offline memory: "${mem.fact}".`,
    };
  }

  // 8. Create Automation
  const autoMatch =
    message.match(/^(?:create\s+automation|add\s+automation|automate)\s*[:\-]?\s*(.+)$/i) ??
    message.match(/^(?:ساخت\s+خودکارسازی|خودکارسازی\s+جدید|خودکارسازی)\s*[:\-]?\s*(.+)$/u);
  if (autoMatch?.[1]) {
    const text = autoMatch[1].trim();
    const rule = await actions.createAutomation({
      name: text.slice(0, 60),
      trigger: isFa ? 'برنامه دستی / روزانه' : 'Manual / Daily schedule',
      actionSummary: text,
      sourceLanguage: lang,
    });
    toolActions.push('offline:create_automation');
    return {
      language: lang,
      toolActions,
      reply: isFa
        ? `قانون خودکارسازی «${rule.name}» به‌صورت آفلاین ایجاد شد.`
        : `Created automation rule "${rule.name}" offline.`,
    };
  }

  // 9. Summarize / List Tasks, Events, Docs, Memory
  if (
    /\b(list|show|summarize|organize|review|my)\b.*\b(task|tasks|todo|schedule|calendar|event|events|file|files|note|notes|memory|memories)\b/i.test(
      message
    ) ||
    /(لیست|نمایش|خلاصه|تنظیم|بررسی).*(وظایف|کارها|تقویم|رویداد|فایل|یادداشت|حافظه)/u.test(
      message
    ) ||
    /^(tasks|وظایف|برنامه)$/iu.test(message)
  ) {
    toolActions.push('offline:workspace_summary');
    const openTasks = snapshot.tasks.filter((t) => t.status !== 'completed');
    const doneCount = snapshot.tasks.length - openTasks.length;

    if (isFa) {
      const taskLines =
        openTasks.length > 0
          ? openTasks
              .slice(0, 8)
              .map(
                (t, i) =>
                  `${i + 1}. ${t.title} [${t.priority}${t.dueDate ? ` · ${t.dueDate}` : ''}]`
              )
              .join('\n')
          : 'هیچ وظیفه بازی در حافظه محلی ثبت نشده است.';
      const eventLines =
        snapshot.events.length > 0
          ? snapshot.events
              .slice(0, 5)
              .map((e) => `- ${e.title} (${e.startTime})`)
              .join('\n')
          : 'رویدادی ثبت نشده است.';
      return {
        language: lang,
        toolActions,
        reply:
          `خلاصه وضعیت آفلاین (داده‌های ذخیره‌شده روی دستگاه):\n\n` +
          `وظایف باز (${openTasks.length} باز، ${doneCount} تکمیل‌شده):\n${taskLines}\n\n` +
          `رویدادهای تقویم (${snapshot.events.length}):\n${eventLines}\n\n` +
          `فایل‌ها: ${snapshot.documents.length} | حافظه‌ها: ${snapshot.memories.length} | خودکارسازی‌ها: ${snapshot.automations.length}`,
      };
    }

    const taskLines =
      openTasks.length > 0
        ? openTasks
            .slice(0, 8)
            .map(
              (t, i) =>
                `${i + 1}. ${t.title} [${t.priority}${t.dueDate ? ` · due ${t.dueDate}` : ''}]`
            )
            .join('\n')
        : 'No open tasks in local offline storage.';
    const eventLines =
      snapshot.events.length > 0
        ? snapshot.events
            .slice(0, 5)
            .map((e) => `- ${e.title} (${e.startTime})`)
            .join('\n')
        : 'No scheduled events cached.';

    return {
      language: lang,
      toolActions,
      reply:
        `Offline Workspace Summary (on-device cache):\n\n` +
        `Open Tasks (${openTasks.length} open, ${doneCount} completed):\n${taskLines}\n\n` +
        `Calendar Events (${snapshot.events.length}):\n${eventLines}\n\n` +
        `Files: ${snapshot.documents.length} · Memories: ${snapshot.memories.length} · Automations: ${snapshot.automations.length}`,
    };
  }

  // 10. Honest offline fallback explaining local commands vs cloud Gemini AI
  return {
    language: lang,
    toolActions,
    reply: isFa
      ? `در حالت آفلاین، پردازش ابری Gemini در دسترس نیست؛ اما موتور آفلاین محلی فعال است و داده‌ها روی دستگاه ذخیره و پس از اتصال همگام‌سازی می‌شوند.\n\n` +
        `دستورهای آماده آفلاین:\n` +
        `• وظیفه جدید: <عنوان> فردا اولویت زیاد\n` +
        `• تکمیل وظیفه: <عنوان>\n` +
        `• حذف وظیفه: <عنوان>\n` +
        `• لیست وظایف من\n` +
        `• ثبت رویداد: <عنوان> فردا 10:30\n` +
        `• لیست فایل‌های کامپیوتر\n` +
        `• ساخت پوشه: <نام پوشه>\n` +
        `• خواندن فایل: <مسیر فایل>\n` +
        `• ساخت فایل <مسیر>: <متن>\n\n` +
        `همچنین می‌توانید مستقیماً از صفحات وظایف، تقویم، فایل‌ها، حافظه و خودکارسازی به‌صورت کامل و آفلاین استفاده کنید.`
      : `Offline Local Mode is active. Cloud Gemini AI reasoning requires an internet connection, but you can run all workspace and connected computer folder actions offline:\n\n` +
        `• Add task: <title> tomorrow high priority\n` +
        `• Complete task: <title>\n` +
        `• List my tasks\n` +
        `• Schedule: <event title> tomorrow 10:30\n` +
        `• List computer files\n` +
        `• Create folder: <folder name>\n` +
        `• Write file notes.txt: <content>\n` +
        `• Read file notes.txt\n\n` +
        `You can also manage Tasks, Calendar, Files, Memory, and Automations directly from the sidebar 100% offline.`,
  };
}
