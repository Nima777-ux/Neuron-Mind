import type {
  AgentModuleDescriptor,
  AutomationRule,
  CalendarEvent,
  Conversation,
  DocumentFile,
  MemoryItem,
  SystemReadiness,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../../types/assistant';

const WORKSPACE_CACHE_KEY = 'neuron_mind_workspace_cache_v1';

export type PendingMutation =
  | {
      mutationId: string;
      entity: 'task';
      action: 'upsert';
      payload: TaskItem;
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'task';
      action: 'update_status';
      payload: { id: string; status: TaskStatus; updatedAt: string };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'task';
      action: 'update_fields';
      payload: {
        id: string;
        title: string;
        priority: TaskPriority;
        dueDate?: string;
        status: TaskStatus;
        updatedAt: string;
      };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'task';
      action: 'delete';
      payload: { id: string };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'event';
      action: 'upsert';
      payload: CalendarEvent;
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'event';
      action: 'delete';
      payload: { id: string };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'document';
      action: 'upsert';
      payload: DocumentFile;
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'document';
      action: 'delete';
      payload: { id: string };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'memory';
      action: 'upsert';
      payload: MemoryItem;
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'memory';
      action: 'delete';
      payload: { id: string };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'automation';
      action: 'upsert';
      payload: AutomationRule;
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'automation';
      action: 'toggle';
      payload: { id: string; enabled: boolean; updatedAt: string };
      createdAt: string;
    }
  | {
      mutationId: string;
      entity: 'automation';
      action: 'delete';
      payload: { id: string };
      createdAt: string;
    };

export interface CachedWorkspaceState {
  tasks: TaskItem[];
  events: CalendarEvent[];
  documents: DocumentFile[];
  memories: MemoryItem[];
  automations: AutomationRule[];
  conversations: Conversation[];
  readiness: SystemReadiness | null;
  modules: AgentModuleDescriptor[];
  pendingMutations: PendingMutation[];
  lastSyncedAt: string | null;
  conflictCount: number;
  lastConflictResolvedAt: string | null;
}

const DEFAULT_CACHE: CachedWorkspaceState = {
  tasks: [],
  events: [],
  documents: [],
  memories: [],
  automations: [],
  conversations: [],
  readiness: null,
  modules: [],
  pendingMutations: [],
  lastSyncedAt: null,
  conflictCount: 0,
  lastConflictResolvedAt: null,
};

export function loadWorkspaceCache(): CachedWorkspaceState {
  if (typeof window === 'undefined') return DEFAULT_CACHE;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_CACHE_KEY);
    if (!raw) return DEFAULT_CACHE;
    const parsed = JSON.parse(raw) as Partial<CachedWorkspaceState>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      automations: Array.isArray(parsed.automations) ? parsed.automations : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      readiness: parsed.readiness ?? null,
      modules: Array.isArray(parsed.modules) ? parsed.modules : [],
      pendingMutations: Array.isArray(parsed.pendingMutations)
        ? parsed.pendingMutations
        : [],
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      conflictCount: typeof parsed.conflictCount === 'number' ? parsed.conflictCount : 0,
      lastConflictResolvedAt:
        typeof parsed.lastConflictResolvedAt === 'string'
          ? parsed.lastConflictResolvedAt
          : null,
    };
  } catch {
    return DEFAULT_CACHE;
  }
}

export function saveWorkspaceCache(state: CachedWorkspaceState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(state));
  } catch {
    try {
      const compact: CachedWorkspaceState = {
        ...state,
        conversations: state.conversations.map((conv) => ({
          ...conv,
          messages: conv.messages.map((m) =>
            m.attachmentPreviews
              ? { ...m, attachmentPreviews: undefined }
              : m
          ),
        })),
      };
      window.localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }
}
