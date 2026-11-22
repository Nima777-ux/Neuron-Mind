export type AppLanguage = 'en' | 'fa';

export type NavigationSection =
  | 'assistant'
  | 'tasks'
  | 'emails'
  | 'files'
  | 'calendar'
  | 'memory'
  | 'automations'
  | 'research'
  | 'workbench'
  | 'hub'
  | 'settings';

export type AssistantDomain =
  | 'tasks'
  | 'emails'
  | 'files'
  | 'calendar'
  | 'memory'
  | 'automations';

export type ModuleIntegrationStatus = 'registered' | 'awaiting_setup' | 'connected';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type MemoryCategory = 'preference' | 'context' | 'workflow';
export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type FinanceEntryType = 'income' | 'expense';
export type FinanceCurrency = 'USD' | 'IRR' | 'EUR';

export interface TaskItem {
  id: string;
  title: string;
  originalText?: string;
  sourceLanguage: AppLanguage;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  clientMutationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  originalText?: string;
  sourceLanguage: AppLanguage;
  startTime: string;
  endTime?: string;
  location?: string;
  clientMutationId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduledActionType =
  | 'none'
  | 'create_folder'
  | 'download_url'
  | 'create_task'
  | 'create_document';

export interface ScheduledEventAction {
  eventId: string;
  eventTitle: string;
  startTime: string;
  location?: string;
  actionType: ScheduledActionType;
  folderPath?: string;
  url?: string;
  taskTitle?: string;
  taskPriority?: TaskPriority;
  docTitle?: string;
  docContent?: string;
  notifiedAt?: string;
  actionStatus?: 'pending' | 'executed' | 'failed';
  actionResult?: string;
}

export interface DocumentFile {
  id: string;
  title: string;
  content: string;
  folder: string;
  sourceLanguage: AppLanguage;
  cachedOffline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryItem {
  id: string;
  fact: string;
  category: MemoryCategory;
  sourceLanguage: AppLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  actionSummary: string;
  enabled: boolean;
  sourceLanguage: AppLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  dueAt: string;
  recurrence: ReminderRecurrence;
  completed: boolean;
  notifiedAt?: string;
  sourceLanguage: AppLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialEntry {
  id: string;
  type: FinanceEntryType;
  amount: number;
  currency: FinanceCurrency;
  category: string;
  note: string;
  date: string;
  sourceLanguage: AppLanguage;
  createdAt: string;
}

export interface BudgetTarget {
  category: string;
  monthlyLimit: number;
  currency: FinanceCurrency;
}

export interface DataTableSchema {
  id: string;
  name: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  createdAt: string;
  updatedAt: string;
}

export interface ClipboardEntry {
  id: string;
  text: string;
  label?: string;
  pinned?: boolean;
  createdAt: string;
}

export interface DownloadRecord {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  savedLocation: 'computer_folder' | 'browser_download';
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  category:
    | 'agent'
    | 'files'
    | 'system'
    | 'security'
    | 'sync'
    | 'automation'
    | 'research'
    | 'finance';
  title: string;
  details?: string;
  status: 'success' | 'warning' | 'error';
  createdAt: string;
}

export interface AuthorizedAppLink {
  id: string;
  name: string;
  uri: string;
  category: 'app' | 'web';
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
  kind: 'image' | 'text';
}

export interface WorkspaceSnapshot {
  tasks: TaskItem[];
  events: CalendarEvent[];
  documents: DocumentFile[];
  memories: MemoryItem[];
  automations: AutomationRule[];
  reminders?: ReminderItem[];
  financialEntries?: FinancialEntry[];
  dataTables?: DataTableSchema[];
  clipboardHistory?: ClipboardEntry[];
  activityLogs?: ActivityLogEntry[];
}

export type WorkspaceMutation =
  | { type: 'task_created'; item: TaskItem }
  | { type: 'task_updated'; item: TaskItem }
  | { type: 'task_deleted'; id: string }
  | { type: 'event_created'; item: CalendarEvent }
  | { type: 'document_created'; item: DocumentFile }
  | { type: 'memory_created'; item: MemoryItem }
  | { type: 'automation_created'; item: AutomationRule }
  | { type: 'reminder_created'; item: ReminderItem }
  | { type: 'reminder_completed'; id: string }
  | { type: 'financial_entry_created'; item: FinancialEntry }
  | { type: 'data_table_created'; item: DataTableSchema }
  | { type: 'data_table_row_inserted'; tableId: string; row: Record<string, string> };

export interface ToolCapability {
  id: string;
  name: string;
  description: string;
}

export interface AgentModuleDescriptor {
  id: string;
  domain: AssistantDomain;
  name: string;
  summary: string;
  status: ModuleIntegrationStatus;
  capabilities: ToolCapability[];
  plannedIntegrations: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  language?: AppLanguage;
  createdAt: string;
  model?: string;
  toolActions?: string[];
  attachmentNames?: string[];
  attachmentPreviews?: Array<{ name: string; dataUrl: string }>;
}

export interface Conversation {
  id: string;
  title: string;
  lastLanguage?: AppLanguage;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface SystemReadiness {
  gemini: {
    configured: boolean;
    model: string;
    mode: 'server_sdk';
  };
  firebase: {
    configured: boolean;
    authProvider: 'firebase_auth';
    storageProvider: 'firestore';
    plannedCollections: string[];
  };
}

export interface AgentOverviewResponse {
  readiness: SystemReadiness;
  modules: AgentModuleDescriptor[];
}

export interface ComputerFolderMountSummary {
  id: string;
  name: string;
  permission: 'granted' | 'prompt' | 'denied';
  entryCount?: number;
}

export interface ComputerFsContext {
  supported: boolean;
  connected: boolean;
  canWrite: boolean;
  mounts: ComputerFolderMountSummary[];
}

export interface ClientToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ClientToolResult {
  id: string;
  name: string;
  response: Record<string, unknown>;
}

export interface AgentChatCompletedResponse {
  status: 'completed';
  conversation: Conversation;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  detectedLanguage: AppLanguage;
  mutations: WorkspaceMutation[];
  toolActions: string[];
}

export interface AgentChatRequiresToolsResponse {
  status: 'requires_client_tools';
  pendingSessionId: string;
  conversationId: string;
  pendingToolCalls: ClientToolCall[];
  toolActions: string[];
}

export type AgentChatResponse =
  | AgentChatCompletedResponse
  | AgentChatRequiresToolsResponse;

export interface DailyImportantEmailItem {
  id: string;
  subject: string;
  from: string;
  date?: string;
  importanceReason: string;
  summary: string;
}

export interface DailyEmailSummary {
  id: string;
  dateKey: string;
  accountEmail: string;
  generatedAt: string;
  totalScanned: number;
  importantEmails: DailyImportantEmailItem[];
  conclusion: string;
  language: AppLanguage;
}

export interface CachedEmailPreview {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  bodyText: string;
  unread: boolean;
  messageIdHeader?: string;
}

export interface CornerNotificationItem {
  id: string;
  kind: 'calendar' | 'reminder' | 'email_summary' | 'system';
  title: string;
  body: string;
  meta?: string;
  statusLabel?: string;
  statusTone?: 'success' | 'warning' | 'error' | 'info';
  actionSection?: NavigationSection;
  createdAt: string;
}

