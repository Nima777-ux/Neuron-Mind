import { buildApiUrl } from '../config/runtimeEnv';
import type {
  AgentChatResponse,
  AgentOverviewResponse,
  AppLanguage,
  ChatAttachment,
  ChatMessage,
  ClientToolResult,
  ComputerFsContext,
  Conversation,
  DailyImportantEmailItem,
  WorkspaceSnapshot,
} from '../types/assistant';

export class AssistantApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message);
    this.name = 'AssistantApiError';
    this.code = code;
    this.status = status;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const gatewayTimeout =
      response.status === 502 || response.status === 503 || response.status === 504;
    const errorMessage =
      payload?.error?.message ??
      (gatewayTimeout && contentType.includes('text/html')
        ? 'The server gateway timed out or restarted while processing your request. Please send it again.'
        : `Request failed with status ${response.status}.`);
    const errorCode = payload?.error?.code ?? 'API_ERROR';
    throw new AssistantApiError(errorMessage, errorCode, response.status);
  }
  if (!payload || typeof payload !== 'object') {
    const isLocalStatic =
      typeof window !== 'undefined' &&
      (window.location.hostname === '127.0.0.1' ||
        (window.location.hostname === 'localhost' && window.location.port === '41735'));
    const msg = isLocalStatic
      ? 'Neuron Mind is running in local offline PC mode without the live server API. Reconnect to the live server URL to run online web search, URL inspection, and remote downloads.'
      : contentType.includes('text/html')
        ? 'The server gateway returned a temporary HTML page (connection timeout or server restart). Please try again.'
        : `Server returned an unexpected ${contentType || 'non-JSON'} response. Please refresh or check your connection.`;
    throw new AssistantApiError(msg, 'NON_JSON_RESPONSE', response.status || 502);
  }
  return payload as T;
}

export async function fetchAgentOverview(): Promise<AgentOverviewResponse> {
  const response = await fetch(buildApiUrl('/api/agent/overview'));
  return parseJsonResponse<AgentOverviewResponse>(response);
}

export async function fetchConversations(): Promise<Conversation[]> {
  const response = await fetch(buildApiUrl('/api/agent/conversations'));
  const data = await parseJsonResponse<{ conversations: Conversation[] }>(response);
  return data.conversations;
}

export async function createConversation(title?: string): Promise<Conversation> {
  const response = await fetch(buildApiUrl('/api/agent/conversations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await parseJsonResponse<{ conversation: Conversation }>(response);
  return data.conversation;
}

export async function sendChatMessage(input: {
  message: string;
  conversationId?: string;
  uiLanguage: AppLanguage;
  history: ChatMessage[];
  workspaceContext: WorkspaceSnapshot;
  computerFsContext?: ComputerFsContext;
  attachments?: ChatAttachment[];
}): Promise<AgentChatResponse> {
  const response = await fetch(buildApiUrl('/api/agent/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<AgentChatResponse>(response);
}

export async function submitClientToolResults(input: {
  pendingSessionId: string;
  toolResults: ClientToolResult[];
}): Promise<AgentChatResponse> {
  const response = await fetch(buildApiUrl('/api/agent/chat/tool-results'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<AgentChatResponse>(response);
}

export interface ResearchResponse {
  summary: string;
  sources: Array<{ title: string; uri: string }>;
  queriedAt: string;
}

export async function runWebResearch(
  query: string,
  language: AppLanguage,
  urls: string[] = []
): Promise<ResearchResponse> {
  const response = await fetch(buildApiUrl('/api/tools/research'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, language, urls }),
  });
  const data = await parseJsonResponse<ResearchResponse>(response);
  if (typeof data.summary !== 'string') {
    throw new AssistantApiError('Web search returned an incomplete payload.', 'INVALID_RESPONSE', 502);
  }
  return {
    summary: data.summary,
    sources: Array.isArray(data.sources) ? data.sources : [],
    queriedAt: data.queriedAt || new Date().toISOString(),
  };
}

export async function inspectPublicUrl(
  url: string,
  prompt: string,
  language: AppLanguage
): Promise<{
  url: string;
  analysis: string;
  sources: Array<{ title: string; uri: string }>;
}> {
  const response = await fetch(buildApiUrl('/api/tools/inspect-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, prompt, language }),
  });
  const data = await parseJsonResponse<{
    url?: string;
    analysis?: string;
    sources?: Array<{ title: string; uri: string }>;
  }>(response);
  if (typeof data.analysis !== 'string') {
    throw new AssistantApiError('Webpage inspection returned an incomplete payload.', 'INVALID_RESPONSE', 502);
  }
  return {
    url: data.url || url,
    analysis: data.analysis,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

export type VideoQualityOption = 'best' | '720p' | '480p' | 'audio';

export async function downloadRemoteUrl(
  url: string,
  options?: {
    quality?: VideoQualityOption;
    cookiesText?: string;
    cobaltApiUrl?: string;
  }
): Promise<{
  success: boolean;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
}> {
  const response = await fetch(buildApiUrl('/api/tools/download-stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      quality: options?.quality ?? 'best',
      ...(options?.cookiesText?.trim() ? { cookiesText: options.cookiesText.trim() } : {}),
      ...(options?.cobaltApiUrl?.trim() ? { cobaltApiUrl: options.cobaltApiUrl.trim() } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const errorMessage =
      payload?.error?.message ?? `Download failed with status ${response.status}.`;
    const errorCode = payload?.error?.code ?? 'DOWNLOAD_ERROR';
    throw new AssistantApiError(errorMessage, errorCode, response.status);
  }

  const blob = await response.blob();
  const headerFilename = response.headers.get('X-Download-Filename');
  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = 'downloaded-file';

  if (headerFilename) {
    try {
      filename = decodeURIComponent(headerFilename);
    } catch {
      filename = headerFilename;
    }
  } else {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (utf8Match?.[1]) {
      try {
        filename = decodeURIComponent(utf8Match[1]);
      } catch {
        filename = utf8Match[1];
      }
    } else if (plainMatch?.[1]) {
      filename = plainMatch[1];
    }
  }

  const headerMime =
    response.headers.get('X-Download-Mime') ||
    response.headers.get('content-type')?.split(';')[0].trim() ||
    blob.type ||
    'application/octet-stream';
  const headerSize = Number(response.headers.get('X-Download-Size'));
  const sizeBytes = Number.isFinite(headerSize) && headerSize > 0 ? headerSize : blob.size;
  const headerSourceUrl = response.headers.get('X-Source-Url');
  let finalUrl = url;
  if (headerSourceUrl) {
    try {
      finalUrl = decodeURIComponent(headerSourceUrl);
    } catch {
      finalUrl = headerSourceUrl;
    }
  }

  return {
    success: true,
    url: finalUrl,
    filename,
    mimeType: headerMime,
    sizeBytes,
    blob,
  };
}

export async function transcribeMeetingAudio(
  audioBase64: string,
  mimeType: string,
  language: AppLanguage
): Promise<{
  transcript: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{ title: string; owner?: string; priority: 'low' | 'medium' | 'high' }>;
}> {
  const response = await fetch(buildApiUrl('/api/agent/transcribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType, language }),
  });
  return parseJsonResponse(response);
}

export async function transcribeVoiceAudio(
  audioBase64: string,
  mimeType: string,
  language: AppLanguage
): Promise<{ transcript: string }> {
  const response = await fetch(buildApiUrl('/api/agent/voice-transcribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType, language }),
  });
  return parseJsonResponse(response);
}

export async function synthesizeReplySpeech(
  text: string,
  language: AppLanguage
): Promise<{ audioBase64: string; mimeType: string }> {
  const response = await fetch(buildApiUrl('/api/agent/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  return parseJsonResponse(response);
}

export async function summarizeEmailsDaily(input: {
  emails: Array<{
    id: string;
    subject: string;
    from: string;
    date?: string;
    unread?: boolean;
    snippet?: string;
    bodyText?: string;
  }>;
  language: AppLanguage;
  accountEmail?: string;
}): Promise<{
  importantEmails: DailyImportantEmailItem[];
  conclusion: string;
  totalScanned: number;
  generatedAt: string;
}> {
  const response = await fetch(buildApiUrl('/api/agent/email-summary'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}
