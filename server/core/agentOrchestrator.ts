import { getServerConfig } from '../config/env.ts';
import { detectTextLanguage } from '../modules/toolDeclarations.ts';
import {
  PLANNED_FIRESTORE_COLLECTIONS,
  type ConversationStore,
} from '../persistence/types.ts';
import {
  resumeAssistantReplyWithToolResults,
  startAssistantReply,
  type PendingGeminiToolState,
} from '../services/geminiClient.ts';
import type { ToolRegistry } from './toolRegistry.ts';
import type {
  AgentModuleDescriptor,
  AppLanguage,
  ChatMessage,
  ClientToolCall,
  ClientToolResult,
  ComputerFsContext,
  Conversation,
  SystemReadiness,
  WorkspaceMutation,
  WorkspaceSnapshot,
} from './types.ts';

interface PendingOrchestratorSession {
  userId: string;
  conversationId: string;
  userMessage: ChatMessage;
  detectedLanguage: AppLanguage;
  geminiState: PendingGeminiToolState;
  expiresAt: number;
}

export type HandleUserMessageResult =
  | {
      status: 'completed';
      conversation: Conversation;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      detectedLanguage: AppLanguage;
      mutations: WorkspaceMutation[];
      toolActions: string[];
    }
  | {
      status: 'requires_client_tools';
      pendingSessionId: string;
      conversationId: string;
      pendingToolCalls: ClientToolCall[];
      toolActions: string[];
    };

export class AgentOrchestrator {
  private readonly registry: ToolRegistry;
  private readonly store: ConversationStore;
  private readonly pendingSessions = new Map<string, PendingOrchestratorSession>();

  constructor(registry: ToolRegistry, store: ConversationStore) {
    this.registry = registry;
    this.store = store;
  }

  getReadiness(): SystemReadiness {
    const config = getServerConfig();
    return {
      gemini: {
        configured: Boolean(config.geminiApiKey),
        model: config.geminiModel,
        mode: 'server_sdk',
      },
      firebase: {
        configured: true,
        authProvider: 'firebase_auth',
        storageProvider: 'firestore',
        plannedCollections: [...PLANNED_FIRESTORE_COLLECTIONS],
      },
    };
  }

  listModules(): AgentModuleDescriptor[] {
    return this.registry.listDescriptors();
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    return this.store.listConversations(userId);
  }

  async createConversation(userId: string, title?: string): Promise<Conversation> {
    return this.store.createConversation(userId, title);
  }

  async getConversation(
    userId: string,
    conversationId: string
  ): Promise<Conversation | undefined> {
    return this.store.getConversation(userId, conversationId);
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [key, session] of this.pendingSessions.entries()) {
      if (session.expiresAt <= now) {
        this.pendingSessions.delete(key);
      }
    }
  }

  private buildComputerFsInstruction(computerFsContext?: ComputerFsContext): string {
    if (!computerFsContext || !computerFsContext.supported) {
      return [
        'LOCAL COMPUTER FILE SYSTEM STATUS:',
        '- Direct folder access is currently unavailable or unsupported in this browser frame.',
        '- If the user asks to manage files/folders on their PC, advise them to open Neuron Mind in the installed Windows Desktop App (or standalone Edge/Chrome window) and click "Connect Computer Folder" in the Files section.',
        '- NEVER claim you read, created, moved, or deleted files on their computer when no folder is connected.',
      ].join('\n');
    }

    const granted = computerFsContext.mounts.filter((m) => m.permission === 'granted');
    const promptNeeded = computerFsContext.mounts.filter((m) => m.permission === 'prompt');

    if (granted.length > 0) {
      const mountSummary = granted
        .map((m) => `"${m.name}" (${m.entryCount ?? '?'} top-level items)`)
        .join(', ');
      return [
        'LOCAL COMPUTER FILE SYSTEM STATUS:',
        `- Connected computer folders with live Read/Write permission: ${mountSummary}.`,
        '- You have REAL tools to manage files and folders inside these connected directories:',
        '  list_computer_directory, read_computer_file, write_computer_file, create_computer_folder, move_or_rename_computer_entry, copy_computer_file, delete_computer_entry, search_computer_files.',
        '- Always inspect the directory first with list_computer_directory before moving, renaming, or editing unfamiliar files.',
        '- Path rule: If multiple folders are connected, prefix paths with the folder name (e.g. "Desktop/Reports/note.md"). If one folder is connected, relative paths like "Reports/note.md" or "MountName/Reports/note.md" both resolve cleanly.',
        '- Report ONLY the exact file/folder paths and results returned by those tools.',
      ].join('\n');
    }

    if (promptNeeded.length > 0) {
      const names = promptNeeded.map((m) => `"${m.name}"`).join(', ');
      return [
        'LOCAL COMPUTER FILE SYSTEM STATUS:',
        `- Previously connected folders awaiting permission re-authorization: ${names}.`,
        '- Ask the user to click "Reconnect" on the folder in the Files view or the Assistant folder bar, then repeat or confirm their request.',
        '- NEVER claim you accessed or modified computer files while permission is not granted.',
      ].join('\n');
    }

    return [
      'LOCAL COMPUTER FILE SYSTEM STATUS:',
      '- No computer folders are connected yet.',
      '- If the user asks to manage files or folders on their PC, ask them to click "Connect Computer Folder" in the Files view (or right below the Assistant header) to grant explicit permission to a folder like Desktop, Documents, or Downloads.',
      '- Do NOT simulate or pretend to access local computer files.',
    ].join('\n');
  }

  private buildSystemInstruction(input: {
    uiLanguage: AppLanguage;
    detectedMessageLanguage: AppLanguage;
    workspaceContext: WorkspaceSnapshot;
    computerFsContext?: ComputerFsContext;
  }): string {
    const modules = this.registry.listDescriptors();
    const moduleLines = modules
      .map((mod) => `- ${mod.name} (${mod.status}): ${mod.summary}`)
      .join('\n');

    const nowIso = new Date().toISOString();

    return [
      'You are Neuron Mind, a universal, ChatGPT-class bilingual (English and Persian / Farsi) AI assistant with deep general world knowledge PLUS optional integrated workspace and computer tools.',
      `Current server timestamp: ${nowIso}`,
      `User UI language: ${input.uiLanguage === 'fa' ? 'Persian (fa)' : 'English (en)'}`,
      `Detected language of the latest user message: ${input.detectedMessageLanguage === 'fa' ? 'Persian (fa)' : 'English (en)'}`,
      '',
      'UNIVERSAL ASSISTANT & LANGUAGE RULES:',
      '1. Answer ANY general knowledge, science, history, geography, technology, coding, mathematics, medicine/health education, creative writing, translation, business, or everyday question directly, thoroughly, and clearly in the user’s language (Persian for Persian or Persian-dominant messages; English for English messages).',
      '2. Do NOT call workspace or web tools for general knowledge questions you already know well. Only call `web_research` when the user asks about live/recent news, current prices/weather/events, or explicitly asks to search the internet, and call `inspect_webpage` when the user asks about a specific URL.',
      '3. IMAGE ANALYSIS: When the user attaches or pastes an image, inspect the visual details carefully (objects, scene, text/OCR, UI, diagrams, code, equations, errors, design) and answer their request completely.',
      '4. WHEN USER INPUT IS NEEDED & IMAGE GENERATION: Only ask the user to connect or provide something when it is genuinely required for an action (e.g., connecting Gmail & Calendar via OAuth for private emails, connecting a local PC folder to manage local files, or attaching a billing-enabled paid Gemini API key in Settings > Secrets for raster AI image generation with `gemini-3.1-flash-lite-image` / `gemini-nano-banana-2.1`). If the user asks you to generate a picture/photo right now without a paid key configured, honestly inform them in their language that raster image generation requires selecting a billing-enabled paid Gemini API key in Settings > Secrets, and offer to write clean SVG vector code or a detailed prompt if helpful. For all general knowledge and image analysis requests, answer directly without asking unnecessary setup questions.',
      '5. Understand informal Persian, colloquial phrasing, and mixed English+Persian messages accurately by intent and keep full conversation context across language switches.',
      '6. When creating tasks, events, documents, memories, reminders, financial entries, or automations, preserve the meaningful title and set sourceLanguage ("en" or "fa") accurately.',
      '7. Workspace tools: use create_task/list_tasks/update_task_status/delete_task, create_calendar_event/list_calendar_events, create_reminder/generate_daily_plan, create_document_note/search_files/search_knowledge_base, save_memory/list_memories, add_financial_transaction/get_financial_summary, create_data_table/insert_table_row/query_data_table, list_clipboard_history/save_clipboard_entry/copy_to_clipboard, download_from_url, launch_authorized_app_or_url, get_system_metrics, compare_computer_files, organize_media_files, inspect_git_repository, scaffold_software_project, create_workspace_backup, and list_activity_history when the user asks for those workspace actions.',
      '8. For emails and Google Calendar sync: call check_emails, read_email_detail, create_email_draft, prepare_send_email, or list_google_calendar_events. If any returns connected: false, honestly tell the user in their language to click "Connect Gmail & Calendar" in Emails/Calendar (never fabricate emails or events). Never send an email silently—always use prepare_send_email or create_email_draft.',
      '9. Honest security boundaries: never pretend to run local shell builds (npm install/gcc), kill OS background processes, or access plaintext Credential Vault secrets.',
      '',
      this.buildComputerFsInstruction(input.computerFsContext),
      '',
      'Current workspace counts:',
      `- Tasks: ${input.workspaceContext.tasks.length}`,
      `- Calendar events: ${input.workspaceContext.events.length}`,
      `- Reminders: ${input.workspaceContext.reminders?.length ?? 0}`,
      `- Files/Documents: ${input.workspaceContext.documents.length}`,
      `- Memories: ${input.workspaceContext.memories.length}`,
      `- Automations: ${input.workspaceContext.automations.length}`,
      `- Financial entries: ${input.workspaceContext.financialEntries?.length ?? 0}`,
      `- Database tables: ${input.workspaceContext.dataTables?.length ?? 0}`,
      `- Clipboard entries: ${input.workspaceContext.clipboardHistory?.length ?? 0}`,
      '',
      'Registered domain modules:',
      moduleLines,
    ].join('\n');
  }

  private async finalizeCompletedTurn(input: {
    userId: string;
    conversationId: string;
    userMessage: ChatMessage;
    detectedLanguage: AppLanguage;
    text: string;
    model: string;
    mutations: WorkspaceMutation[];
    toolActions: string[];
  }): Promise<HandleUserMessageResult> {
    const assistantLanguage = detectTextLanguage(input.text);

    const assistantMessage = await this.store.appendMessage(
      input.userId,
      input.conversationId,
      {
        role: 'assistant',
        content: input.text,
        language: assistantLanguage,
        model: input.model,
        toolActions: input.toolActions,
      }
    );

    const finalConversation =
      (await this.store.getConversation(input.userId, input.conversationId)) ??
      (await this.store.createConversation(input.userId));
    finalConversation.lastLanguage = assistantLanguage;

    return {
      status: 'completed',
      conversation: finalConversation,
      userMessage: input.userMessage,
      assistantMessage,
      detectedLanguage: input.detectedLanguage,
      mutations: input.mutations,
      toolActions: input.toolActions,
    };
  }

  async handleUserMessage(input: {
    userId: string;
    conversationId?: string;
    content: string;
    uiLanguage?: AppLanguage;
    clientHistory?: ChatMessage[];
    workspaceContext?: Partial<WorkspaceSnapshot>;
    computerFsContext?: ComputerFsContext;
    attachments?: import('./types.ts').ChatAttachment[];
  }): Promise<HandleUserMessageResult> {
    this.pruneExpiredSessions();

    const detectedLanguage = detectTextLanguage(input.content);
    const uiLanguage: AppLanguage = input.uiLanguage === 'fa' ? 'fa' : 'en';

    const workspaceContext: WorkspaceSnapshot = {
      tasks: Array.isArray(input.workspaceContext?.tasks)
        ? input.workspaceContext.tasks
        : [],
      events: Array.isArray(input.workspaceContext?.events)
        ? input.workspaceContext.events
        : [],
      documents: Array.isArray(input.workspaceContext?.documents)
        ? input.workspaceContext.documents
        : [],
      memories: Array.isArray(input.workspaceContext?.memories)
        ? input.workspaceContext.memories
        : [],
      automations: Array.isArray(input.workspaceContext?.automations)
        ? input.workspaceContext.automations
        : [],
      reminders: Array.isArray(input.workspaceContext?.reminders)
        ? input.workspaceContext.reminders
        : [],
      financialEntries: Array.isArray(input.workspaceContext?.financialEntries)
        ? input.workspaceContext.financialEntries
        : [],
      dataTables: Array.isArray(input.workspaceContext?.dataTables)
        ? input.workspaceContext.dataTables
        : [],
      clipboardHistory: Array.isArray(input.workspaceContext?.clipboardHistory)
        ? input.workspaceContext.clipboardHistory
        : [],
      activityLogs: Array.isArray(input.workspaceContext?.activityLogs)
        ? input.workspaceContext.activityLogs
        : [],
    };

    let conversation: Conversation | undefined;
    if (input.conversationId) {
      conversation = await this.store.getConversation(
        input.userId,
        input.conversationId
      );
    }
    if (!conversation) {
      conversation = await this.store.createConversation(input.userId);
    }

    const userMessage = await this.store.appendMessage(
      input.userId,
      conversation.id,
      {
        role: 'user',
        content: input.content,
        language: detectedLanguage,
        attachmentNames:
          input.attachments && input.attachments.length > 0
            ? input.attachments.map((a) => a.name)
            : undefined,
      }
    );

    const updatedConversation = await this.store.getConversation(
      input.userId,
      conversation.id
    );

    const historyFromClient =
      Array.isArray(input.clientHistory) && input.clientHistory.length > 0
        ? [
            ...input.clientHistory.filter((m) => m.id !== userMessage.id),
            userMessage,
          ]
        : undefined;

    const history =
      historyFromClient &&
      historyFromClient.length >= (updatedConversation?.messages.length ?? 0)
        ? historyFromClient
        : updatedConversation?.messages ?? [userMessage];

    const outcome = await startAssistantReply({
      history,
      systemInstruction: this.buildSystemInstruction({
        uiLanguage,
        detectedMessageLanguage: detectedLanguage,
        workspaceContext,
        computerFsContext: input.computerFsContext,
      }),
      workspaceContext,
      language: detectedLanguage,
      latestAttachments: input.attachments,
    });

    if (outcome.status === 'requires_client_tools') {
      const pendingSessionId = outcome.pendingState.id;
      this.pendingSessions.set(pendingSessionId, {
        userId: input.userId,
        conversationId: conversation.id,
        userMessage,
        detectedLanguage,
        geminiState: outcome.pendingState,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      return {
        status: 'requires_client_tools',
        pendingSessionId,
        conversationId: conversation.id,
        pendingToolCalls: outcome.pendingState.pendingCalls,
        toolActions: [...outcome.pendingState.toolActions],
      };
    }

    return this.finalizeCompletedTurn({
      userId: input.userId,
      conversationId: conversation.id,
      userMessage,
      detectedLanguage,
      text: outcome.text,
      model: outcome.model,
      mutations: outcome.mutations,
      toolActions: outcome.toolActions,
    });
  }

  async submitClientToolResults(input: {
    userId: string;
    pendingSessionId: string;
    toolResults: ClientToolResult[];
  }): Promise<HandleUserMessageResult> {
    this.pruneExpiredSessions();

    const session = this.pendingSessions.get(input.pendingSessionId);
    if (!session || session.userId !== input.userId) {
      throw new Error('Tool execution session expired or was not found. Please send your request again.');
    }

    this.pendingSessions.delete(input.pendingSessionId);

    const outcome = await resumeAssistantReplyWithToolResults(
      session.geminiState,
      input.toolResults
    );

    if (outcome.status === 'requires_client_tools') {
      const nextSessionId = outcome.pendingState.id;
      this.pendingSessions.set(nextSessionId, {
        userId: session.userId,
        conversationId: session.conversationId,
        userMessage: session.userMessage,
        detectedLanguage: session.detectedLanguage,
        geminiState: outcome.pendingState,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      return {
        status: 'requires_client_tools',
        pendingSessionId: nextSessionId,
        conversationId: session.conversationId,
        pendingToolCalls: outcome.pendingState.pendingCalls,
        toolActions: [...outcome.pendingState.toolActions],
      };
    }

    return this.finalizeCompletedTurn({
      userId: session.userId,
      conversationId: session.conversationId,
      userMessage: session.userMessage,
      detectedLanguage: session.detectedLanguage,
      text: outcome.text,
      model: outcome.model,
      mutations: outcome.mutations,
      toolActions: outcome.toolActions,
    });
  }
}
