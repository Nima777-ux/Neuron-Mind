import type { AgentToolModule } from '../core/types.ts';

export const tasksModule: AgentToolModule = {
  id: 'module.tasks',
  domain: 'tasks',
  name: 'Tasks',
  summary:
    'Captures, prioritizes, and tracks personal action items across English and Persian with offline queuing and Firestore sync.',
  status: 'connected',
  capabilities: [
    {
      id: 'tasks.create',
      name: 'Create & structure tasks',
      description: 'Parse natural language requests in English or Persian into structured tasks.',
    },
    {
      id: 'tasks.prioritize',
      name: 'Prioritize daily queue',
      description: 'Filter, update, and retrieve tasks regardless of creation language.',
    },
  ],
  plannedIntegrations: [
    'Firestore tasks collection active',
    'Gemini function declarations active',
  ],
};

export const emailsModule: AgentToolModule = {
  id: 'module.emails',
  domain: 'emails',
  name: 'Emails',
  summary:
    'Read, search, summarize, draft, reply to, and confirm-send real Gmail messages across English and Persian.',
  status: 'connected',
  capabilities: [
    {
      id: 'emails.summarize',
      name: 'Thread summarization & triage',
      description: 'Read and condense live Gmail threads into key decisions and pending requests.',
    },
    {
      id: 'emails.draft',
      name: 'Draft & confirm-send',
      description: 'Save Gmail drafts and prepare replies in English or Persian with explicit send confirmation.',
    },
  ],
  plannedIntegrations: [
    'Gmail OAuth (gmail.readonly & gmail.compose) active',
    'Interactive client-side read/draft/confirm-send tool bindings',
  ],
};

export const filesModule: AgentToolModule = {
  id: 'module.files',
  domain: 'files',
  name: 'Files',
  summary:
    'Manage connected computer folders and files (list, read, create, rename, move, search, delete) plus offline workspace documents.',
  status: 'connected',
  capabilities: [
    {
      id: 'files.computer_fs',
      name: 'Local computer folders',
      description:
        'Browse, organize, read, write, move, rename, and search real folders on your PC with explicit folder permission.',
    },
    {
      id: 'files.search',
      name: 'Document lookup',
      description: 'Search workspace documents and connected computer files across English and Persian.',
    },
    {
      id: 'files.offline',
      name: 'Offline document cache',
      description: 'Pin workspace documents locally so they remain accessible without connectivity.',
    },
  ],
  plannedIntegrations: [
    'Local Computer Folder Access (File System Access API / Tauri FS) active',
    'Firestore documents collection active',
  ],
};

export const calendarModule: AgentToolModule = {
  id: 'module.calendar',
  domain: 'calendar',
  name: 'Calendar',
  summary:
    'Coordinate schedules, create events in English or Persian, and access cached events offline.',
  status: 'connected',
  capabilities: [
    {
      id: 'calendar.agenda',
      name: 'Agenda briefing',
      description: 'Review upcoming events with localized date and time formatting.',
    },
    {
      id: 'calendar.schedule',
      name: 'Event creation',
      description: 'Create language-independent events synchronized with Firestore.',
    },
  ],
  plannedIntegrations: [
    'Firestore events collection active',
    'Optional external Google Calendar OAuth sync',
  ],
};

export const memoryModule: AgentToolModule = {
  id: 'module.memory',
  domain: 'memory',
  name: 'Memory',
  summary:
    'Persist durable preferences, recurring context, and personal knowledge across English and Persian sessions.',
  status: 'connected',
  capabilities: [
    {
      id: 'memory.preferences',
      name: 'Preference recall',
      description: 'Remember formatting habits, language preferences, and routines.',
    },
    {
      id: 'memory.facts',
      name: 'Long-term context',
      description: 'Store user-approved facts for retrieval in future threads.',
    },
  ],
  plannedIntegrations: [
    'Firestore memories collection active',
    'User-editable memory controls active',
  ],
};

export const automationsModule: AgentToolModule = {
  id: 'module.automations',
  domain: 'automations',
  name: 'Automations',
  summary:
    'Define scheduled briefings and reminder rules that coordinate Neuron Mind capabilities safely.',
  status: 'connected',
  capabilities: [
    {
      id: 'automations.briefings',
      name: 'Scheduled digests',
      description: 'Define recurring morning or evening summary routines.',
    },
    {
      id: 'automations.rules',
      name: 'Reminder rules',
      description: 'Create and toggle user-controlled reminder triggers.',
    },
  ],
  plannedIntegrations: [
    'Firestore automations collection active',
    'Gemini automation creation tool active',
  ],
};

export const defaultAgentModules: AgentToolModule[] = [
  tasksModule,
  emailsModule,
  filesModule,
  calendarModule,
  memoryModule,
  automationsModule,
];
