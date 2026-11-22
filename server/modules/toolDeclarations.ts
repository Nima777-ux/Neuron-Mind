import { Type, type FunctionDeclaration } from '@google/genai';
import crypto from 'node:crypto';
import type {
  AppLanguage,
  AutomationRule,
  CalendarEvent,
  DataTableSchema,
  DocumentFile,
  FinanceCurrency,
  FinanceEntryType,
  FinancialEntry,
  MemoryCategory,
  MemoryItem,
  ReminderItem,
  ReminderRecurrence,
  TaskItem,
  TaskPriority,
  TaskStatus,
  WorkspaceMutation,
  WorkspaceSnapshot,
} from '../core/types.ts';
import { inspectWebpage, performWebResearch } from '../services/researchService.ts';

export function detectTextLanguage(text: string): AppLanguage {
  const persianMatches = text.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const latinMatches = text.match(/[A-Za-z]/g);
  const persianCount = persianMatches ? persianMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;
  if (persianCount === 0) return 'en';
  if (persianCount >= latinCount || persianCount >= 3) return 'fa';
  return 'en';
}

export const NEURON_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // Tasks
  {
    name: 'create_task',
    description:
      'Create a new language-independent task in the user workspace. Use whenever the user asks to add, create, schedule, or remember an action item in English or Persian.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Concise task title preserving the user phrasing.' },
        originalText: { type: Type.STRING, description: 'Original phrasing from the user request.' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
        priority: { type: Type.STRING, description: '"low", "medium", or "high".' },
        dueDate: { type: Type.STRING, description: 'Optional due date (e.g. "2026-11-20").' },
      },
      required: ['title', 'sourceLanguage'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Retrieve current tasks from the workspace across English and Persian entries.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: '"all", "todo", "in_progress", or "completed".' },
        query: { type: Type.STRING, description: 'Optional keyword search.' },
      },
    },
  },
  {
    name: 'update_task_status',
    description: 'Update an existing task status (todo, in_progress, or completed).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskIdOrTitle: { type: Type.STRING, description: 'Task ID or partial title.' },
        status: { type: Type.STRING, description: '"todo", "in_progress", or "completed".' },
      },
      required: ['taskIdOrTitle', 'status'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task by its ID or matching title.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskIdOrTitle: { type: Type.STRING, description: 'Task ID or title.' },
      },
      required: ['taskIdOrTitle'],
    },
  },

  // Calendar
  {
    name: 'create_calendar_event',
    description: 'Create a structured calendar event or meeting in the user schedule.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Event title.' },
        originalText: { type: Type.STRING, description: 'Original user phrasing.' },
        startTime: { type: Type.STRING, description: 'Start date/time (ISO-8601 preferred).' },
        endTime: { type: Type.STRING, description: 'Optional end date/time.' },
        location: { type: Type.STRING, description: 'Optional location or meeting link.' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
      },
      required: ['title', 'startTime', 'sourceLanguage'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming calendar events stored in the workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Optional keyword filter.' },
      },
    },
  },

  // Reminders & Daily Scheduler
  {
    name: 'create_reminder',
    description: 'Create a one-time or recurring reminder with an optional due date/time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Reminder message/title.' },
        dueAt: { type: Type.STRING, description: 'ISO date/time when reminder should fire (e.g. "2026-11-20T09:00").' },
        recurrence: { type: Type.STRING, description: '"none", "daily", "weekly", or "monthly".' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
      },
      required: ['title', 'dueAt', 'sourceLanguage'],
    },
  },
  {
    name: 'list_reminders',
    description: 'List active and completed reminders.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeCompleted: { type: Type.BOOLEAN, description: 'Include completed reminders (default false).' },
      },
    },
  },
  {
    name: 'complete_reminder',
    description: 'Mark a reminder completed by ID or matching title.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reminderIdOrTitle: { type: Type.STRING, description: 'Reminder ID or partial title.' },
      },
      required: ['reminderIdOrTitle'],
    },
  },
  {
    name: 'generate_daily_plan',
    description:
      'Analyze open tasks, calendar events, and reminders to produce a prioritized daily productivity plan and time-blocked schedule.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetDate: { type: Type.STRING, description: 'Target date (YYYY-MM-DD), defaults to today.' },
        focusHoursStart: { type: Type.STRING, description: 'Preferred workday start hour like "09:00".' },
      },
    },
  },

  // Documents & Knowledge Base
  {
    name: 'create_document_note',
    description: 'Create a structured document, note, summary, or report in the Files workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Document title.' },
        content: { type: Type.STRING, description: 'Full markdown or plain text content.' },
        folder: { type: Type.STRING, description: 'Folder name such as "Reports", "Notes", or "General".' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
      },
      required: ['title', 'content', 'sourceLanguage'],
    },
  },
  {
    name: 'search_files',
    description: 'Search workspace documents and notes across English and Persian content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search keyword or phrase.' },
      },
    },
  },
  {
    name: 'search_knowledge_base',
    description:
      'Search across the entire personal Knowledge Base: workspace documents, stored memories, tasks, and custom database tables.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query or topic.' },
      },
      required: ['query'],
    },
  },

  // Memory & Automations & Email
  {
    name: 'save_memory',
    description: 'Save an explicit user preference, personal context, or workflow instruction to persistent memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: { type: Type.STRING, description: 'The preference or context to remember.' },
        category: { type: Type.STRING, description: '"preference", "context", or "workflow".' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
      },
      required: ['fact', 'category', 'sourceLanguage'],
    },
  },
  {
    name: 'list_memories',
    description: 'Retrieve stored user memories and preferences.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Optional filter text.' },
      },
    },
  },
  {
    name: 'create_automation',
    description: 'Create an automation rule or recurring workflow in the Automations module.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Short name for the automation.' },
        trigger: { type: Type.STRING, description: 'Trigger schedule or condition.' },
        actionSummary: { type: Type.STRING, description: 'What the automation does.' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
      },
      required: ['name', 'trigger', 'actionSummary', 'sourceLanguage'],
    },
  },
  {
    name: 'check_emails',
    description:
      'List or search real Gmail inbox messages for the signed-in user. Never fabricate emails if the client tool reports connected: false.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Optional Gmail search query (e.g. "is:unread", "from:alice", or keyword).' },
        maxResults: { type: Type.NUMBER, description: 'Maximum messages to fetch (1-20, default 10).' },
      },
    },
  },
  {
    name: 'read_email_detail',
    description: 'Read the full subject, headers, and plain text body of a specific Gmail message by ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        messageId: { type: Type.STRING, description: 'Gmail message ID returned by check_emails.' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'create_email_draft',
    description: 'Create and save a real draft email in the user Gmail Drafts folder without sending it.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Email subject.' },
        body: { type: Type.STRING, description: 'Email body text.' },
        threadId: { type: Type.STRING, description: 'Optional Gmail threadId if replying.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'prepare_send_email',
    description:
      'Request explicit user confirmation in a modal dialog to send an email via Gmail. Always requires user click to approve before actually sending.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address.' },
        subject: { type: Type.STRING, description: 'Email subject.' },
        body: { type: Type.STRING, description: 'Full email body text.' },
        threadId: { type: Type.STRING, description: 'Optional Gmail threadId if replying.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'list_google_calendar_events',
    description: 'Fetch upcoming events directly from the user connected Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        maxResults: { type: Type.NUMBER, description: 'Maximum events to fetch (default 15).' },
      },
    },
  },

  // Finance Manager
  {
    name: 'add_financial_transaction',
    description: 'Record a personal income or expense entry in the Financial Manager.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, description: '"income" or "expense".' },
        amount: { type: Type.NUMBER, description: 'Numeric amount.' },
        currency: { type: Type.STRING, description: '"USD", "IRR", or "EUR" (default USD).' },
        category: { type: Type.STRING, description: 'Category like "Groceries", "Salary", "Software", "Rent".' },
        note: { type: Type.STRING, description: 'Short description or note.' },
        date: { type: Type.STRING, description: 'Date YYYY-MM-DD (defaults to today).' },
        sourceLanguage: { type: Type.STRING, description: '"en" or "fa".' },
      },
      required: ['type', 'amount', 'category'],
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Calculate financial summary (totals by currency and category) and recent transactions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: 'Optional category filter.' },
      },
    },
  },

  // Database / Tables Manager
  {
    name: 'create_data_table',
    description: 'Create a structured database table with custom columns in the Database Manager.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Table name.' },
        columns: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Column names, e.g. ["Name", "Email", "Status"].',
        },
      },
      required: ['name', 'columns'],
    },
  },
  {
    name: 'insert_table_row',
    description: 'Insert a row of key-value fields into an existing structured database table.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tableIdOrName: { type: Type.STRING, description: 'Table ID or name.' },
        valuesJson: { type: Type.STRING, description: 'JSON object mapping column names to string values.' },
      },
      required: ['tableIdOrName', 'valuesJson'],
    },
  },
  {
    name: 'query_data_table',
    description: 'List tables or query rows inside a structured database table.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tableIdOrName: { type: Type.STRING, description: 'Optional table ID or name.' },
        query: { type: Type.STRING, description: 'Optional text filter across row values.' },
      },
    },
  },

  // Activity History
  {
    name: 'list_activity_history',
    description: 'Retrieve recent system, file, security, and agent activity audit logs.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: 'Optional category filter.' },
        limit: { type: Type.NUMBER, description: 'Maximum entries to return (default 20).' },
      },
    },
  },

  // Live Internet Research & Webpage Inspection
  {
    name: 'web_research',
    description:
      'Search the live web using Google Search and summarize verified findings with source URLs. Use whenever the user asks to search the internet, verify current facts, compare online products/topics, or gather information.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search query in English or Persian.' },
        urls: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional public URLs to compare or inspect.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'inspect_webpage',
    description: 'Read and analyze a specific public webpage URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Public http/https URL to read.' },
        question: { type: Type.STRING, description: 'What to extract or summarize from the page.' },
      },
      required: ['url'],
    },
  },

  // Client Computer, Media, Dev, Git, Backup, System, Clipboard, Download & App Tools
  {
    name: 'list_computer_directory',
    description:
      'List files and subfolders inside the user connected computer folders. Always call this first before organizing, reading, or modifying computer files.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        folderPath: { type: Type.STRING, description: 'Relative path inside connected folders.' },
        recursive: { type: Type.BOOLEAN, description: 'Set true for recursive listing.' },
        maxDepth: { type: Type.NUMBER, description: 'Recursion depth 1-4 (default 2).' },
      },
    },
  },
  {
    name: 'read_computer_file',
    description: 'Read UTF-8 text content of a file in a connected computer folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: { type: Type.STRING, description: 'Relative path to file.' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_computer_file',
    description: 'Create or update/append a text/code file in a connected computer folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: { type: Type.STRING, description: 'Relative file path.' },
        content: { type: Type.STRING, description: 'Full text/code content.' },
        mode: { type: Type.STRING, description: '"overwrite" (default) or "append".' },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'create_computer_folder',
    description: 'Create a folder (including nested parent folders) inside a connected computer directory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        folderPath: { type: Type.STRING, description: 'Relative path of the new folder.' },
      },
      required: ['folderPath'],
    },
  },
  {
    name: 'move_or_rename_computer_entry',
    description: 'Move or rename a file or folder inside connected computer folders.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sourcePath: { type: Type.STRING, description: 'Current relative path.' },
        destinationPath: { type: Type.STRING, description: 'Destination relative path.' },
      },
      required: ['sourcePath', 'destinationPath'],
    },
  },
  {
    name: 'copy_computer_file',
    description: 'Copy a file inside connected computer folders.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sourcePath: { type: Type.STRING, description: 'Source file path.' },
        destinationPath: { type: Type.STRING, description: 'Destination file path.' },
      },
      required: ['sourcePath', 'destinationPath'],
    },
  },
  {
    name: 'delete_computer_entry',
    description:
      'Delete a file or folder inside connected computer folders (desktop UI prompts user confirmation first).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Relative path to delete.' },
        recursive: { type: Type.BOOLEAN, description: 'Required true for non-empty folders.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_computer_files',
    description: 'Search connected computer folders by filename or text file content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search term.' },
        folderPath: { type: Type.STRING, description: 'Optional subfolder path.' },
        searchContent: { type: Type.BOOLEAN, description: 'Search inside text files.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'compare_computer_files',
    description:
      'Compare two text or code files in connected computer folders and report differences, shared lines, and size/line stats.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        firstFilePath: { type: Type.STRING, description: 'First relative file path.' },
        secondFilePath: { type: Type.STRING, description: 'Second relative file path.' },
      },
      required: ['firstFilePath', 'secondFilePath'],
    },
  },
  {
    name: 'organize_media_files',
    description:
      'Scan a connected computer folder for photos, videos, audio, and documents, and optionally move them into organized Media/Photos, Media/Videos, Media/Audio, and Media/Documents subfolders.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        folderPath: { type: Type.STRING, description: 'Folder path to scan/organize.' },
        applyMove: {
          type: Type.BOOLEAN,
          description: 'If false (default), only preview categorization counts; if true, move files into categorized subfolders.',
        },
      },
    },
  },
  {
    name: 'inspect_git_repository',
    description:
      'Inspect Git repository metadata (HEAD branch, remotes, recent commit log) inside a connected computer project folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        folderPath: { type: Type.STRING, description: 'Path to project root inside connected folder.' },
      },
    },
  },
  {
    name: 'scaffold_software_project',
    description:
      'Create a multi-file starter software project inside a connected computer folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        folderPath: { type: Type.STRING, description: 'Target folder path for the new project.' },
        projectName: { type: Type.STRING, description: 'Project name (kebab-case).' },
        template: {
          type: Type.STRING,
          description: '"node-ts", "react-vite-ts", "python-cli", or "static-web".',
        },
      },
      required: ['folderPath', 'projectName', 'template'],
    },
  },
  {
    name: 'create_workspace_backup',
    description:
      'Create a verified backup snapshot of workspace data (and save it to a connected computer Backups folder or trigger browser download).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetFolder: { type: Type.STRING, description: 'Optional subfolder like "Backups".' },
      },
    },
  },
  {
    name: 'get_system_metrics',
    description:
      'Read real client hardware, storage quota, memory, network, and server system telemetry.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'list_clipboard_history',
    description: 'List saved entries in the Neuron Mind Clipboard Manager.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Optional search filter.' },
      },
    },
  },
  {
    name: 'save_clipboard_entry',
    description: 'Save a text snippet into Clipboard History and optionally copy it to the system clipboard.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'Text to store.' },
        label: { type: Type.STRING, description: 'Optional short label.' },
        copyToSystemClipboard: { type: Type.BOOLEAN, description: 'Also write to OS clipboard.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'copy_to_clipboard',
    description: 'Write specific text to the user clipboard and record it in clipboard history.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'Text to copy.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'download_from_url',
    description:
      'Download a file from a permitted public http/https URL via the safe Download Manager and save it into a connected computer folder (or download directly) while logging it in Download History.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Public http/https file URL.' },
        saveFolderPath: { type: Type.STRING, description: 'Optional connected PC subfolder such as "Downloads".' },
      },
      required: ['url'],
    },
  },
  {
    name: 'launch_authorized_app_or_url',
    description:
      'Prepare or open an authorized URL or registered OS protocol URI (e.g. https://, mailto:, vscode:, ms-settings:) safely.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        uri: { type: Type.STRING, description: 'URL or protocol URI to open.' },
        label: { type: Type.STRING, description: 'Human-readable application or site name.' },
      },
      required: ['uri'],
    },
  },
];

export const CLIENT_COMPUTER_TOOL_NAMES = new Set<string>([
  'list_computer_directory',
  'read_computer_file',
  'write_computer_file',
  'create_computer_folder',
  'move_or_rename_computer_entry',
  'copy_computer_file',
  'delete_computer_entry',
  'search_computer_files',
  'compare_computer_files',
  'organize_media_files',
  'inspect_git_repository',
  'scaffold_software_project',
  'create_workspace_backup',
  'get_system_metrics',
  'list_clipboard_history',
  'save_clipboard_entry',
  'copy_to_clipboard',
  'download_from_url',
  'launch_authorized_app_or_url',
  'check_emails',
  'read_email_detail',
  'create_email_draft',
  'prepare_send_email',
  'list_google_calendar_events',
]);

export const ASYNC_SERVER_TOOL_NAMES = new Set<string>([
  'web_research',
  'inspect_webpage',
]);

function normalizeLang(value: unknown, fallbackText: string): AppLanguage {
  if (value === 'fa' || value === 'en') return value;
  return detectTextLanguage(fallbackText);
}

export async function executeAsyncServerTool(
  toolName: string,
  args: Record<string, unknown>,
  language: AppLanguage
): Promise<Record<string, unknown>> {
  if (toolName === 'web_research') {
    const query = String(args.query ?? '').trim();
    const urls = Array.isArray(args.urls)
      ? args.urls.filter((u): u is string => typeof u === 'string')
      : [];
    const result = await performWebResearch(query, language, urls);
    return { success: true, ...result };
  }

  if (toolName === 'inspect_webpage') {
    const url = String(args.url ?? '').trim();
    const question = String(args.question ?? '').trim();
    const result = await inspectWebpage(url, question, language);
    return { success: true, ...result };
  }

  return { success: false, error: `Unknown async server tool: ${toolName}` };
}

export function executeWorkspaceTool(
  toolName: string,
  args: Record<string, unknown>,
  snapshot: WorkspaceSnapshot,
  mutations: WorkspaceMutation[]
): Record<string, unknown> {
  const now = new Date().toISOString();

  switch (toolName) {
    case 'create_task': {
      const title = String(args.title ?? '').trim() || 'Untitled task';
      const originalText = String(args.originalText ?? title).trim();
      const sourceLanguage = normalizeLang(args.sourceLanguage, title);
      const priorityRaw = String(args.priority ?? 'medium');
      const priority: TaskPriority =
        priorityRaw === 'low' || priorityRaw === 'high' ? priorityRaw : 'medium';
      const dueDate =
        typeof args.dueDate === 'string' && args.dueDate.trim()
          ? args.dueDate.trim().slice(0, 40)
          : undefined;

      const task: TaskItem = {
        id: crypto.randomUUID(),
        title: title.slice(0, 300),
        originalText: originalText.slice(0, 1000),
        sourceLanguage,
        status: 'todo',
        priority,
        dueDate,
        createdAt: now,
        updatedAt: now,
      };
      snapshot.tasks.unshift(task);
      mutations.push({ type: 'task_created', item: task });
      return { success: true, task };
    }

    case 'list_tasks': {
      const status = typeof args.status === 'string' ? args.status : 'all';
      const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
      const filtered = snapshot.tasks.filter((task) => {
        if (status !== 'all' && task.status !== status) return false;
        if (!query) return true;
        return (
          task.title.toLowerCase().includes(query) ||
          (task.originalText ?? '').toLowerCase().includes(query)
        );
      });
      return { count: filtered.length, tasks: filtered };
    }

    case 'update_task_status': {
      const needle = String(args.taskIdOrTitle ?? '').trim().toLowerCase();
      const statusRaw = String(args.status ?? 'completed');
      const status: TaskStatus =
        statusRaw === 'todo' || statusRaw === 'in_progress' || statusRaw === 'completed'
          ? statusRaw
          : 'completed';

      const target = snapshot.tasks.find(
        (t) =>
          t.id.toLowerCase() === needle ||
          t.title.toLowerCase().includes(needle) ||
          (t.originalText ?? '').toLowerCase().includes(needle)
      );

      if (!target) return { success: false, error: 'Task not found.' };
      target.status = status;
      target.updatedAt = now;
      mutations.push({ type: 'task_updated', item: { ...target } });
      return { success: true, task: target };
    }

    case 'delete_task': {
      const needle = String(args.taskIdOrTitle ?? '').trim().toLowerCase();
      const idx = snapshot.tasks.findIndex(
        (t) =>
          t.id.toLowerCase() === needle ||
          t.title.toLowerCase().includes(needle) ||
          (t.originalText ?? '').toLowerCase().includes(needle)
      );
      if (idx === -1) return { success: false, error: 'Task not found.' };
      const [removed] = snapshot.tasks.splice(idx, 1);
      mutations.push({ type: 'task_deleted', id: removed.id });
      return { success: true, deletedId: removed.id };
    }

    case 'create_calendar_event': {
      const title = String(args.title ?? '').trim() || 'Scheduled Event';
      const originalText = String(args.originalText ?? title).trim();
      const startTime = String(args.startTime ?? now).trim().slice(0, 40);
      const endTime =
        typeof args.endTime === 'string' && args.endTime.trim()
          ? args.endTime.trim().slice(0, 40)
          : undefined;
      const location =
        typeof args.location === 'string' && args.location.trim()
          ? args.location.trim().slice(0, 200)
          : undefined;
      const sourceLanguage = normalizeLang(args.sourceLanguage, title);

      const event: CalendarEvent = {
        id: crypto.randomUUID(),
        title: title.slice(0, 300),
        originalText: originalText.slice(0, 1000),
        sourceLanguage,
        startTime,
        endTime,
        location,
        createdAt: now,
        updatedAt: now,
      };
      snapshot.events.unshift(event);
      mutations.push({ type: 'event_created', item: event });
      return { success: true, event };
    }

    case 'list_calendar_events': {
      const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
      const filtered = snapshot.events.filter((ev) =>
        !query
          ? true
          : ev.title.toLowerCase().includes(query) ||
            (ev.location ?? '').toLowerCase().includes(query)
      );
      return { count: filtered.length, events: filtered };
    }

    case 'create_reminder': {
      const title = String(args.title ?? '').trim() || 'Reminder';
      const dueAt = String(args.dueAt ?? now).trim().slice(0, 40);
      const recRaw = String(args.recurrence ?? 'none');
      const recurrence: ReminderRecurrence =
        recRaw === 'daily' || recRaw === 'weekly' || recRaw === 'monthly'
          ? recRaw
          : 'none';
      const sourceLanguage = normalizeLang(args.sourceLanguage, title);

      const reminder: ReminderItem = {
        id: crypto.randomUUID(),
        title: title.slice(0, 300),
        dueAt,
        recurrence,
        completed: false,
        sourceLanguage,
        createdAt: now,
        updatedAt: now,
      };
      if (!snapshot.reminders) snapshot.reminders = [];
      snapshot.reminders.unshift(reminder);
      mutations.push({ type: 'reminder_created', item: reminder });
      return { success: true, reminder };
    }

    case 'list_reminders': {
      const includeCompleted = Boolean(args.includeCompleted);
      const list = (snapshot.reminders ?? []).filter(
        (r) => includeCompleted || !r.completed
      );
      return { count: list.length, reminders: list };
    }

    case 'complete_reminder': {
      const needle = String(args.reminderIdOrTitle ?? '').trim().toLowerCase();
      const target = (snapshot.reminders ?? []).find(
        (r) => r.id.toLowerCase() === needle || r.title.toLowerCase().includes(needle)
      );
      if (!target) return { success: false, error: 'Reminder not found.' };
      target.completed = true;
      target.updatedAt = now;
      mutations.push({ type: 'reminder_completed', id: target.id });
      return { success: true, reminder: target };
    }

    case 'generate_daily_plan': {
      const targetDate =
        typeof args.targetDate === 'string' && args.targetDate.trim()
          ? args.targetDate.trim()
          : now.slice(0, 10);
      const openTasks = [...snapshot.tasks]
        .filter((t) => t.status !== 'completed')
        .sort((a, b) => {
          const rank = { high: 0, medium: 1, low: 2 };
          return rank[a.priority] - rank[b.priority];
        });
      const dayEvents = snapshot.events.filter((e) => e.startTime.startsWith(targetDate));
      const dueReminders = (snapshot.reminders ?? []).filter(
        (r) => !r.completed && r.dueAt.startsWith(targetDate)
      );
      return {
        success: true,
        targetDate,
        openTaskCount: openTasks.length,
        prioritizedTasks: openTasks.slice(0, 12),
        scheduledEvents: dayEvents,
        dueReminders,
      };
    }

    case 'create_document_note': {
      const title = String(args.title ?? '').trim() || 'Untitled Document';
      const content = String(args.content ?? '').slice(0, 32000);
      const folder = String(args.folder ?? 'Notes').trim().slice(0, 120) || 'Notes';
      const sourceLanguage = normalizeLang(args.sourceLanguage, title + ' ' + content);

      const doc: DocumentFile = {
        id: crypto.randomUUID(),
        title: title.slice(0, 300),
        content,
        folder,
        sourceLanguage,
        cachedOffline: true,
        createdAt: now,
        updatedAt: now,
      };
      snapshot.documents.unshift(doc);
      mutations.push({ type: 'document_created', item: doc });
      return { success: true, document: doc };
    }

    case 'search_files': {
      const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
      const filtered = snapshot.documents.filter((doc) =>
        !query
          ? true
          : doc.title.toLowerCase().includes(query) ||
            doc.content.toLowerCase().includes(query) ||
            doc.folder.toLowerCase().includes(query)
      );
      return { count: filtered.length, documents: filtered };
    }

    case 'search_knowledge_base': {
      const q = String(args.query ?? '').trim().toLowerCase();
      const matchedDocs = snapshot.documents.filter(
        (d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)
      );
      const matchedMemories = snapshot.memories.filter((m) =>
        m.fact.toLowerCase().includes(q)
      );
      const matchedTasks = snapshot.tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.originalText ?? '').toLowerCase().includes(q)
      );
      const matchedTables = (snapshot.dataTables ?? []).filter(
        (tbl) =>
          tbl.name.toLowerCase().includes(q) ||
          JSON.stringify(tbl.rows).toLowerCase().includes(q)
      );
      return {
        query: q,
        documents: matchedDocs,
        memories: matchedMemories,
        tasks: matchedTasks,
        tables: matchedTables,
      };
    }

    case 'save_memory': {
      const fact = String(args.fact ?? '').trim().slice(0, 1000);
      const catRaw = String(args.category ?? 'context');
      const category: MemoryCategory =
        catRaw === 'preference' || catRaw === 'workflow' ? catRaw : 'context';
      const sourceLanguage = normalizeLang(args.sourceLanguage, fact);

      const memory: MemoryItem = {
        id: crypto.randomUUID(),
        fact,
        category,
        sourceLanguage,
        createdAt: now,
        updatedAt: now,
      };
      snapshot.memories.unshift(memory);
      mutations.push({ type: 'memory_created', item: memory });
      return { success: true, memory };
    }

    case 'list_memories': {
      const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
      const filtered = snapshot.memories.filter((m) =>
        !query ? true : m.fact.toLowerCase().includes(query)
      );
      return { count: filtered.length, memories: filtered };
    }

    case 'create_automation': {
      const name = String(args.name ?? '').trim().slice(0, 200) || 'Reminder';
      const trigger = String(args.trigger ?? 'Scheduled').trim().slice(0, 200);
      const actionSummary =
        String(args.actionSummary ?? '').trim().slice(0, 500) || name;
      const sourceLanguage = normalizeLang(args.sourceLanguage, name);

      const rule: AutomationRule = {
        id: crypto.randomUUID(),
        name,
        trigger,
        actionSummary,
        enabled: true,
        sourceLanguage,
        createdAt: now,
        updatedAt: now,
      };
      snapshot.automations.unshift(rule);
      mutations.push({ type: 'automation_created', item: rule });
      return { success: true, automation: rule };
    }

    case 'check_emails': {
      return {
        connected: false,
        module: 'emails',
        message:
          'No external email account (Gmail / IMAP) is connected via OAuth yet. Do not invent or fabricate emails; clearly inform the user that email integration requires authorizing Gmail OAuth.',
      };
    }

    case 'add_financial_transaction': {
      const type: FinanceEntryType = args.type === 'income' ? 'income' : 'expense';
      const amount = Math.abs(Number(args.amount) || 0);
      const currRaw = String(args.currency ?? 'USD').toUpperCase();
      const currency: FinanceCurrency =
        currRaw === 'IRR' || currRaw === 'EUR' ? currRaw : 'USD';
      const category = String(args.category ?? 'General').trim().slice(0, 80) || 'General';
      const note = String(args.note ?? '').trim().slice(0, 300);
      const date =
        typeof args.date === 'string' && args.date.trim()
          ? args.date.trim().slice(0, 20)
          : now.slice(0, 10);
      const sourceLanguage = normalizeLang(args.sourceLanguage, category + ' ' + note);

      const entry: FinancialEntry = {
        id: crypto.randomUUID(),
        type,
        amount,
        currency,
        category,
        note,
        date,
        sourceLanguage,
        createdAt: now,
      };
      if (!snapshot.financialEntries) snapshot.financialEntries = [];
      snapshot.financialEntries.unshift(entry);
      mutations.push({ type: 'financial_entry_created', item: entry });
      return { success: true, entry };
    }

    case 'get_financial_summary': {
      const catFilter =
        typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
      const entries = (snapshot.financialEntries ?? []).filter((e) =>
        !catFilter ? true : e.category.toLowerCase().includes(catFilter)
      );
      const totalsByCurrency: Record<string, { income: number; expense: number; net: number }> = {};
      for (const e of entries) {
        if (!totalsByCurrency[e.currency]) {
          totalsByCurrency[e.currency] = { income: 0, expense: 0, net: 0 };
        }
        if (e.type === 'income') totalsByCurrency[e.currency].income += e.amount;
        else totalsByCurrency[e.currency].expense += e.amount;
        totalsByCurrency[e.currency].net =
          totalsByCurrency[e.currency].income - totalsByCurrency[e.currency].expense;
      }
      return {
        count: entries.length,
        totalsByCurrency,
        recentEntries: entries.slice(0, 20),
      };
    }

    case 'create_data_table': {
      const name = String(args.name ?? '').trim() || 'Table';
      const columns = Array.isArray(args.columns)
        ? args.columns.map((c) => String(c).trim()).filter(Boolean)
        : ['Item', 'Notes'];
      const table: DataTableSchema = {
        id: crypto.randomUUID(),
        name: name.slice(0, 120),
        columns: columns.length > 0 ? columns : ['Item'],
        rows: [],
        createdAt: now,
        updatedAt: now,
      };
      if (!snapshot.dataTables) snapshot.dataTables = [];
      snapshot.dataTables.unshift(table);
      mutations.push({ type: 'data_table_created', item: table });
      return { success: true, table };
    }

    case 'insert_table_row': {
      const needle = String(args.tableIdOrName ?? '').trim().toLowerCase();
      const target = (snapshot.dataTables ?? []).find(
        (t) => t.id.toLowerCase() === needle || t.name.toLowerCase() === needle
      );
      if (!target) return { success: false, error: 'Database table not found.' };
      let parsedRow: Record<string, unknown> = {};
      try {
        parsedRow = JSON.parse(String(args.valuesJson ?? '{}'));
      } catch {
        return { success: false, error: 'Invalid JSON row payload.' };
      }
      const cleanRow: Record<string, string> = {};
      for (const col of target.columns) {
        cleanRow[col] = String(parsedRow[col] ?? '');
      }
      target.rows.push(cleanRow);
      target.updatedAt = now;
      mutations.push({ type: 'data_table_row_inserted', tableId: target.id, row: cleanRow });
      return { success: true, tableName: target.name, row: cleanRow };
    }

    case 'query_data_table': {
      const needle =
        typeof args.tableIdOrName === 'string'
          ? args.tableIdOrName.trim().toLowerCase()
          : '';
      const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
      const tables = snapshot.dataTables ?? [];
      if (!needle) {
        return {
          count: tables.length,
          tables: tables.map((t) => ({
            id: t.id,
            name: t.name,
            columns: t.columns,
            rowCount: t.rows.length,
          })),
        };
      }
      const target = tables.find(
        (t) => t.id.toLowerCase() === needle || t.name.toLowerCase().includes(needle)
      );
      if (!target) return { success: false, error: 'Database table not found.' };
      const rows = !q
        ? target.rows
        : target.rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
      return { success: true, table: target.name, columns: target.columns, rows };
    }

    case 'list_activity_history': {
      const category = typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const logs = (snapshot.activityLogs ?? [])
        .filter((l) => (!category ? true : l.category.toLowerCase() === category))
        .slice(0, limit);
      return { count: logs.length, entries: logs };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
