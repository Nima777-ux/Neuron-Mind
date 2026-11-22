import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type Part,
} from '@google/genai';
import crypto from 'node:crypto';
import { getServerConfig } from '../config/env.ts';
import type {
  AppLanguage,
  ChatAttachment,
  ChatMessage,
  ClientToolCall,
  ClientToolResult,
  WorkspaceMutation,
  WorkspaceSnapshot,
} from '../core/types.ts';
import {
  ASYNC_SERVER_TOOL_NAMES,
  CLIENT_COMPUTER_TOOL_NAMES,
  executeAsyncServerTool,
  executeWorkspaceTool,
  NEURON_TOOL_DECLARATIONS,
} from '../modules/toolDeclarations.ts';

export class GeminiConfigurationError extends Error {
  readonly code = 'GEMINI_NOT_CONFIGURED';
  readonly statusCode = 503;

  constructor(message = 'GEMINI_API_KEY is not configured on the server.') {
    super(message);
    this.name = 'GeminiConfigurationError';
  }
}

export class GeminiUpstreamError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, statusCode = 502, code = 'GEMINI_UPSTREAM_ERROR') {
    super(message);
    this.name = 'GeminiUpstreamError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function createGeminiClient(timeoutMs = 30000): GoogleGenAI {
  const { geminiApiKey } = getServerConfig();
  if (!geminiApiKey) {
    throw new GeminiConfigurationError(
      'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable assistant responses.'
    );
  }

  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      timeout: Math.max(10500, timeoutMs),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface PendingGeminiToolState {
  id: string;
  systemInstruction: string;
  contents: Content[];
  workingSnapshot: WorkspaceSnapshot;
  mutations: WorkspaceMutation[];
  toolActions: string[];
  serverResponseParts: Part[];
  pendingCalls: ClientToolCall[];
  stepsUsed: number;
  language: AppLanguage;
  createdAt: number;
}

export type GeminiLoopOutcome =
  | {
      status: 'completed';
      text: string;
      model: string;
      mutations: WorkspaceMutation[];
      toolActions: string[];
    }
  | {
      status: 'requires_client_tools';
      pendingState: PendingGeminiToolState;
    };

export interface GenerateAssistantReplyInput {
  history: ChatMessage[];
  systemInstruction: string;
  workspaceContext: WorkspaceSnapshot;
  language: AppLanguage;
  latestAttachments?: ChatAttachment[];
}

const MAX_TOOL_STEPS = 12;
const REQUEST_BUDGET_MS = 35000;
const MODEL_COOLDOWN_MS = 3 * 60 * 1000;
const modelCooldownUntil = new Map<string, number>();

function isModelInCooldown(modelName: string): boolean {
  const until = modelCooldownUntil.get(modelName) ?? 0;
  if (until <= Date.now()) {
    modelCooldownUntil.delete(modelName);
    return false;
  }
  return true;
}

function recordModelSuccess(modelName: string): void {
  modelCooldownUntil.delete(modelName);
}

function markModelFailure(modelName: string): void {
  modelCooldownUntil.set(modelName, Date.now() + MODEL_COOLDOWN_MS);
}

function isFallbackEligibleError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('500') ||
    msg.includes('404') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('deadline_exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('not_found') ||
    msg.includes('internal') ||
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset')
  );
}

function buildModelConfig(
  modelName: string,
  systemInstruction: string,
  includeTools: boolean
) {
  const isGemini4 = modelName.startsWith('gemini-4-');
  return {
    systemInstruction,
    ...(includeTools ? { tools: [{ functionDeclarations: NEURON_TOOL_DECLARATIONS }] } : {}),
    ...(isGemini4 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
  };
}

async function generateWithModelFallback(params: {
  ai: GoogleGenAI;
  preferredModel: string;
  contents: Content[];
  systemInstruction: string;
  includeTools: boolean;
  deadlineAt: number;
}) {
  const { ai, preferredModel, contents, systemInstruction, includeTools, deadlineAt } = params;
  const baseOrder = Array.from(
    new Set([preferredModel, 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'])
  );
  const available = baseOrder.filter((m) => !isModelInCooldown(m));
  const candidateModels = available.length > 0 ? available : ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];

  let lastError: unknown;
  for (let i = 0; i < candidateModels.length; i += 1) {
    const modelName = candidateModels[i];
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < 4000) {
      break;
    }
    const hasNextFallback = i < candidateModels.length - 1;
    // Keep primary attempt <= 13s when fallback exists so total turn stays well under 30s gateway timeouts.
    const maxForAttempt = hasNextFallback ? 13000 : 18000;
    const attemptTimeoutMs = Math.max(10500, Math.min(remainingMs, maxForAttempt));
    const attemptClient = attemptTimeoutMs !== 30000 ? createGeminiClient(attemptTimeoutMs) : ai;
    const t0 = Date.now();

    try {
      const response = await attemptClient.models.generateContent({
        model: modelName,
        contents,
        config: buildModelConfig(modelName, systemInstruction, includeTools),
      });
      recordModelSuccess(modelName);
      return { response, activeModel: modelName };
    } catch (error) {
      lastError = error;
      const elapsed = Date.now() - t0;
      const canFallback = isFallbackEligibleError(error) && hasNextFallback;
      if (isFallbackEligibleError(error)) {
        markModelFailure(modelName);
      }
      if (canFallback) {
        console.info(
          `[Gemini] Model "${modelName}" timed out or was busy after ${elapsed}ms; retrying with fallback model.`
        );
        continue;
      }
      const errText = error instanceof Error ? error.message : String(error);
      console.error(`[Gemini] Model "${modelName}" failed after ${elapsed}ms:`, errText);
      throw error;
    }
  }

  throw (
    lastError ??
    new GeminiUpstreamError(
      'The AI model is temporarily experiencing high demand. Please retry in a moment.',
      503,
      'GEMINI_UNAVAILABLE'
    )
  );
}

function mapGeminiError(error: unknown): never {
  if (
    error instanceof GeminiConfigurationError ||
    error instanceof GeminiUpstreamError
  ) {
    throw error;
  }

  const message =
    error instanceof Error ? error.message : 'Failed to communicate with Gemini API.';

  if (message.includes('API_KEY_INVALID') || message.toLowerCase().includes('api key not valid')) {
    throw new GeminiUpstreamError(
      'The server Gemini API key appears invalid. Verify GEMINI_API_KEY in Settings > Secrets.',
      400,
      'API_KEY_INVALID'
    );
  }

  if (message.includes('INVALID_ARGUMENT') || message.includes('"code":400')) {
    throw new GeminiUpstreamError(
      `Gemini request validation failed: ${message}`,
      400,
      'INVALID_ARGUMENT'
    );
  }

  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    throw new GeminiUpstreamError(
      'Permission denied by Gemini API. Check your key permissions in Settings > Secrets.',
      403,
      'PERMISSION_DENIED'
    );
  }

  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    throw new GeminiUpstreamError(
      'Gemini API quota exhausted. Check your quota or billing tier in Settings > Secrets.',
      429,
      'RESOURCE_EXHAUSTED'
    );
  }

  if (
    message.includes('UNAVAILABLE') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('DEADLINE_EXCEEDED') ||
    message.toLowerCase().includes('abort') ||
    message.toLowerCase().includes('timeout')
  ) {
    throw new GeminiUpstreamError(
      'The AI model is temporarily experiencing high demand. Please retry in a moment.',
      503,
      'GEMINI_UNAVAILABLE'
    );
  }

  throw new GeminiUpstreamError(message, 502, 'GEMINI_UPSTREAM_ERROR');
}

async function runGeminiToolLoop(params: {
  ai: GoogleGenAI;
  geminiModel: string;
  systemInstruction: string;
  contents: Content[];
  workingSnapshot: WorkspaceSnapshot;
  mutations: WorkspaceMutation[];
  toolActions: string[];
  stepsUsed: number;
  language: AppLanguage;
}): Promise<GeminiLoopOutcome> {
  const {
    ai,
    geminiModel,
    systemInstruction,
    contents,
    workingSnapshot,
    mutations,
    toolActions,
    language,
  } = params;

  const deadlineAt = Date.now() + REQUEST_BUDGET_MS;
  let currentModel = geminiModel;

  try {
    for (let step = params.stepsUsed; step < MAX_TOOL_STEPS; step += 1) {
      const { response, activeModel } = await generateWithModelFallback({
        ai,
        preferredModel: currentModel,
        contents,
        systemInstruction,
        includeTools: true,
        deadlineAt,
      });
      currentModel = activeModel;

      const functionCalls = response.functionCalls;
      const modelContent = response.candidates?.[0]?.content;

      if (!functionCalls || functionCalls.length === 0) {
        const text = response.text?.trim();
        if (!text) {
          throw new GeminiUpstreamError(
            'Gemini returned an empty response.',
            502,
            'GEMINI_EMPTY_RESPONSE'
          );
        }

        return {
          status: 'completed',
          text,
          model: currentModel,
          mutations,
          toolActions,
        };
      }

      if (modelContent) {
        contents.push(modelContent);
      }

      const serverResponseParts: Part[] = [];
      const pendingCalls: ClientToolCall[] = [];

      for (const call of functionCalls) {
        const toolName = call.name ?? '';
        const args = (call.args ?? {}) as Record<string, unknown>;
        const callId = call.id ?? `call-${crypto.randomUUID()}`;

        if (CLIENT_COMPUTER_TOOL_NAMES.has(toolName)) {
          toolActions.push(toolName);
          pendingCalls.push({
            id: callId,
            name: toolName,
            args,
          });
        } else if (ASYNC_SERVER_TOOL_NAMES.has(toolName)) {
          let result: Record<string, unknown>;
          try {
            result = await executeAsyncServerTool(toolName, args, language);
          } catch (err) {
            result = {
              success: false,
              error: err instanceof Error ? err.message : 'Research tool failed.',
            };
          }
          toolActions.push(toolName);
          serverResponseParts.push({
            functionResponse: {
              id: call.id,
              name: toolName,
              response: { result },
            },
          });
        } else {
          const result = executeWorkspaceTool(
            toolName,
            args,
            workingSnapshot,
            mutations
          );
          toolActions.push(toolName);
          serverResponseParts.push({
            functionResponse: {
              id: call.id,
              name: toolName,
              response: { result },
            },
          });
        }
      }

      if (pendingCalls.length > 0) {
        return {
          status: 'requires_client_tools',
          pendingState: {
            id: crypto.randomUUID(),
            systemInstruction,
            contents,
            workingSnapshot,
            mutations,
            toolActions,
            serverResponseParts,
            pendingCalls,
            stepsUsed: step + 1,
            language,
            createdAt: Date.now(),
          },
        };
      }

      contents.push({
        role: 'user',
        parts: serverResponseParts,
      });
    }

    const { response: finalResponse, activeModel } = await generateWithModelFallback({
      ai,
      preferredModel: currentModel,
      contents,
      systemInstruction,
      includeTools: false,
      deadlineAt,
    });

    const text = finalResponse.text?.trim();
    if (!text) {
      throw new GeminiUpstreamError(
        'Gemini returned an empty response after tool execution.',
        502,
        'GEMINI_EMPTY_RESPONSE'
      );
    }

    return {
      status: 'completed',
      text,
      model: activeModel,
      mutations,
      toolActions,
    };
  } catch (error) {
    mapGeminiError(error);
  }
}

export async function startAssistantReply(
  input: GenerateAssistantReplyInput
): Promise<GeminiLoopOutcome> {
  const { geminiModel } = getServerConfig();
  const ai = createGeminiClient();

  const contents: Content[] = input.history.map((msg, idx) => {
    const isLast = idx === input.history.length - 1;
    const parts: Part[] = [{ text: msg.content }];

    if (isLast && msg.role === 'user' && input.latestAttachments && input.latestAttachments.length > 0) {
      for (const att of input.latestAttachments) {
        if (att.kind === 'image' && att.base64Data) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType || 'image/png',
              data: att.base64Data,
            },
          });
        } else if (att.kind === 'text' && att.textContent) {
          parts.push({
            text: `\n[Attached file: ${att.name}]\n${att.textContent.slice(0, 24000)}`,
          });
        }
      }
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const workingSnapshot: WorkspaceSnapshot = {
    tasks: input.workspaceContext.tasks.map((t) => ({ ...t })),
    events: input.workspaceContext.events.map((e) => ({ ...e })),
    documents: input.workspaceContext.documents.map((d) => ({ ...d })),
    memories: input.workspaceContext.memories.map((m) => ({ ...m })),
    automations: input.workspaceContext.automations.map((a) => ({ ...a })),
    reminders: (input.workspaceContext.reminders ?? []).map((r) => ({ ...r })),
    financialEntries: (input.workspaceContext.financialEntries ?? []).map((f) => ({ ...f })),
    dataTables: (input.workspaceContext.dataTables ?? []).map((dt) => ({
      ...dt,
      columns: [...dt.columns],
      rows: dt.rows.map((r) => ({ ...r })),
    })),
    clipboardHistory: (input.workspaceContext.clipboardHistory ?? []).map((c) => ({ ...c })),
    activityLogs: (input.workspaceContext.activityLogs ?? []).map((a) => ({ ...a })),
  };

  return runGeminiToolLoop({
    ai,
    geminiModel,
    systemInstruction: input.systemInstruction,
    contents,
    workingSnapshot,
    mutations: [],
    toolActions: [],
    stepsUsed: 0,
    language: input.language,
  });
}

export async function resumeAssistantReplyWithToolResults(
  pendingState: PendingGeminiToolState,
  clientResults: ClientToolResult[]
): Promise<GeminiLoopOutcome> {
  const { geminiModel } = getServerConfig();
  const ai = createGeminiClient();

  const clientParts: Part[] = clientResults.map((res) => ({
    functionResponse: {
      id: res.id,
      name: res.name,
      response: { result: res.response },
    },
  }));

  pendingState.contents.push({
    role: 'user',
    parts: [...pendingState.serverResponseParts, ...clientParts],
  });

  return runGeminiToolLoop({
    ai,
    geminiModel,
    systemInstruction: pendingState.systemInstruction,
    contents: pendingState.contents,
    workingSnapshot: pendingState.workingSnapshot,
    mutations: pendingState.mutations,
    toolActions: pendingState.toolActions,
    stepsUsed: pendingState.stepsUsed,
    language: pendingState.language,
  });
}

export interface EmailSummaryInputItem {
  id: string;
  subject: string;
  from: string;
  date?: string;
  unread?: boolean;
  snippet?: string;
  bodyText?: string;
}

export interface EmailSummaryOutput {
  importantEmails: Array<{
    id: string;
    subject: string;
    from: string;
    date?: string;
    importanceReason: string;
    summary: string;
  }>;
  conclusion: string;
}

function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function summarizeImportantEmails(input: {
  emails: EmailSummaryInputItem[];
  language: AppLanguage;
  accountEmail?: string;
}): Promise<EmailSummaryOutput> {
  const { emails, language } = input;
  if (!emails || emails.length === 0) {
    return {
      importantEmails: [],
      conclusion:
        language === 'fa'
          ? 'امروز ایمیل جدیدی در صندوق متصل برای خلاصه‌سازی یافت نشد.'
          : 'No messages were found in the connected mailbox to summarize today.',
    };
  }

  const { geminiModel } = getServerConfig();
  const ai = createGeminiClient(22000);
  const compactEmails = emails.slice(0, 20).map((e) => ({
    id: e.id,
    subject: e.subject || '(No Subject)',
    from: e.from || 'Unknown',
    date: e.date || '',
    unread: Boolean(e.unread),
    excerpt: (e.bodyText || e.snippet || '').slice(0, 800),
  }));

  const systemInstruction =
    language === 'fa'
      ? `شما تحلیل‌گر ایمیل نورون مایند هستید. ایمیل‌های ورودی را بررسی کنید، فقط ایمیل‌های واقعاً مهم (فوری، کاری، مالی، امنیتی، پاسخ لازم، جلسه یا مهلت زمانی) را انتخاب کنید و برای هر کدام یک خلاصه کوتاه و دلیل اهمیت بنویسید. سپس یک نتیجه‌گیری و جمع‌بندی عملی برای پایان روز بنویسید.
خروجی باید دقیقاً یک JSON معتبر با این ساختار باشد:
{"importantEmails":[{"id":"...","subject":"...","from":"...","date":"...","importanceReason":"...","summary":"..."}],"conclusion":"..."}`
      : `You are Neuron Mind's executive email analyst. Review the provided emails, select the genuinely important ones (urgent, work/client, deadlines, security, billing/finance, action required, meetings), write a concise summary and importance reason for each, and finish with a clear end-of-day conclusion and next steps.
Return ONLY valid JSON matching:
{"importantEmails":[{"id":"...","subject":"...","from":"...","date":"...","importanceReason":"...","summary":"..."}],"conclusion":"..."}`;

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: `Mailbox account: ${input.accountEmail || 'Connected Gmail'}\nEmails (${compactEmails.length}):\n${JSON.stringify(compactEmails)}`,
        },
      ],
    },
  ];

  try {
    const { response } = await generateWithModelFallback({
      ai,
      preferredModel: geminiModel,
      contents,
      systemInstruction,
      includeTools: false,
      deadlineAt: Date.now() + 26000,
    });

    const rawText = response.text?.trim() ?? '';
    const cleaned = stripJsonCodeFence(rawText);
    const parsed = JSON.parse(cleaned) as Partial<EmailSummaryOutput>;
    const importantEmails = Array.isArray(parsed.importantEmails)
      ? parsed.importantEmails
          .filter((item) => item && typeof item.subject === 'string')
          .map((item) => ({
            id: String(item.id || ''),
            subject: String(item.subject || '(No Subject)'),
            from: String(item.from || 'Unknown'),
            date: typeof item.date === 'string' ? item.date : undefined,
            importanceReason: String(item.importanceReason || ''),
            summary: String(item.summary || ''),
          }))
      : [];

    const conclusion =
      typeof parsed.conclusion === 'string' && parsed.conclusion.trim()
        ? parsed.conclusion.trim()
        : language === 'fa'
          ? 'بررسی ایمیل‌های امروز تکمیل شد.'
          : 'Daily important email triage completed.';

    return { importantEmails, conclusion };
  } catch (error) {
    if (error instanceof GeminiConfigurationError) {
      throw error;
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.toLowerCase().includes('json')) {
      return {
        importantEmails: compactEmails.slice(0, 3).map((e) => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          date: e.date || undefined,
          importanceReason: language === 'fa' ? 'پیام اخیر صندوق' : 'Recent inbox message',
          summary: e.excerpt.slice(0, 180) || e.subject,
        })),
        conclusion:
          language === 'fa'
            ? 'خلاصه خودکار بر اساس پیام‌های اخیر آماده شد.'
            : 'Summary prepared from recent mailbox messages.',
      };
    }
    mapGeminiError(error);
  }
}

