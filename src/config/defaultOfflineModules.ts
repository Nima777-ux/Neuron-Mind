import type { AgentModuleDescriptor } from '../types/assistant';

export const DEFAULT_OFFLINE_MODULES: AgentModuleDescriptor[] = [
  {
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
        description: 'Create and update structured tasks online and offline.',
      },
      {
        id: 'tasks.prioritize',
        name: 'Prioritize daily queue',
        description: 'Filter, update, and retrieve tasks regardless of language.',
      },
    ],
    plannedIntegrations: [
      'Firestore persistent offline cache active',
      'Offline local task engine active',
    ],
  },
  {
    id: 'module.emails',
    domain: 'emails',
    name: 'Emails',
    summary:
      'Read, search, summarize, draft, reply to, and confirm-send Gmail messages when signed in.',
    status: 'connected',
    capabilities: [
      {
        id: 'emails.summarize',
        name: 'Thread summarization & triage',
        description: 'Condense Gmail threads into key decisions and pending requests.',
      },
      {
        id: 'emails.draft',
        name: 'Draft & confirm-send',
        description: 'Compose drafts and send emails after explicit confirmation.',
      },
    ],
    plannedIntegrations: ['Gmail & Google Calendar OAuth connector'],
  },
  {
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
    plannedIntegrations: ['Local Computer Folder Access + offline store active'],
  },
  {
    id: 'module.calendar',
    domain: 'calendar',
    name: 'Calendar',
    summary:
      'Coordinate schedules, create events in English or Persian, and access cached events offline.',
    status: 'connected',
    capabilities: [
      {
        id: 'calendar.schedule',
        name: 'Event creation',
        description: 'Create language-independent events synchronized with Firestore.',
      },
    ],
    plannedIntegrations: ['Offline schedule cache active'],
  },
  {
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
    ],
    plannedIntegrations: ['Offline memory store active'],
  },
  {
    id: 'module.automations',
    domain: 'automations',
    name: 'Automations',
    summary:
      'Define scheduled briefings and reminder rules that coordinate Neuron Mind capabilities safely.',
    status: 'connected',
    capabilities: [
      {
        id: 'automations.rules',
        name: 'Reminder rules',
        description: 'Create and toggle user-controlled reminder triggers.',
      },
    ],
    plannedIntegrations: ['Offline automation rule store active'],
  },
];
