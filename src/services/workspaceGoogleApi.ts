export interface GmailMessageSummary {
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

export interface GoogleCalendarEventItem {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
}

export class WorkspaceAuthExpiredError extends Error {
  constructor(message = 'Google session expired or missing permission. Please reconnect.') {
    super(message);
    this.name = 'WorkspaceAuthExpiredError';
  }
}

export class WorkspaceApiDisabledError extends Error {
  readonly projectNumber: string;
  readonly gmailEnableUrl: string;
  readonly calendarEnableUrl: string;

  constructor(message: string, projectNumber = '1022597897742') {
    super(message);
    this.name = 'WorkspaceApiDisabledError';
    this.projectNumber = projectNumber;
    this.gmailEnableUrl = `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${projectNumber}`;
    this.calendarEnableUrl = `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${projectNumber}`;
  }
}

function decodeBase64UrlUtf8(data: string): string {
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4;
    const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeBase64UrlUtf8(text: string): string {
  return encodeBase64Utf8(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeRfc2047Subject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) {
    return subject;
  }
  return `=?UTF-8?B?${encodeBase64Utf8(subject)}?=`;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function extractBodyText(payload?: GmailPart): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64UrlUtf8(payload.body.data).trim();
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const found = extractBodyText(part);
      if (found) return found;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return stripHtmlTags(decodeBase64UrlUtf8(payload.body.data));
  }
  if (payload.body?.data) {
    return decodeBase64UrlUtf8(payload.body.data).trim();
  }
  return '';
}

function parseGmailMessage(raw: Record<string, unknown>): GmailMessageSummary {
  const payload = (raw.payload ?? {}) as GmailPart & {
    headers?: Array<{ name?: string; value?: string }>;
  };
  const headers = Array.isArray(payload.headers) ? payload.headers : [];
  const getHeader = (name: string): string => {
    const match = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
    return match?.value ?? '';
  };

  const labelIds = Array.isArray(raw.labelIds)
    ? raw.labelIds.filter((l): l is string => typeof l === 'string')
    : [];

  const bodyText =
    extractBodyText(payload) || (typeof raw.snippet === 'string' ? raw.snippet : '');

  return {
    id: String(raw.id ?? ''),
    threadId: String(raw.threadId ?? ''),
    subject: getHeader('Subject') || '(No Subject)',
    from: getHeader('From') || 'Unknown sender',
    to: getHeader('To'),
    date: getHeader('Date'),
    snippet: String(raw.snippet ?? ''),
    bodyText: bodyText.slice(0, 12000),
    unread: labelIds.includes('UNREAD'),
    messageIdHeader: getHeader('Message-ID') || undefined,
  };
}

export interface WorkspaceScopeCheckResult {
  checked: boolean;
  grantedScopes: string[];
  missingScopes: string[];
}

export async function verifyGoogleWorkspaceScopes(
  accessToken: string,
  requiredScopes: readonly string[]
): Promise<WorkspaceScopeCheckResult> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) {
      return { checked: false, grantedScopes: [], missingScopes: [] };
    }
    const data = (await res.json()) as { scope?: string };
    const grantedScopes =
      typeof data.scope === 'string'
        ? data.scope
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const grantedSet = new Set(grantedScopes);
    const missingScopes = requiredScopes.filter((scope) => {
      if (grantedSet.has(scope)) return false;
      // https://mail.google.com/ implies all Gmail scopes; https://www.googleapis.com/auth/calendar implies calendar.events
      if (
        (scope.includes('gmail.') && grantedSet.has('https://mail.google.com/')) ||
        (scope.includes('calendar.') && grantedSet.has('https://www.googleapis.com/auth/calendar'))
      ) {
        return false;
      }
      return true;
    });
    return { checked: true, grantedScopes, missingScopes };
  } catch {
    return { checked: false, grantedScopes: [], missingScopes: [] };
  }
}

interface GoogleApiErrorShape {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    details?: Array<{ reason?: string; metadata?: Record<string, string> }>;
  };
}

async function workspaceFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    let parsed: GoogleApiErrorShape | null = null;
    try {
      parsed = (await res.json()) as GoogleApiErrorShape;
    } catch {
      parsed = null;
    }

    const message = parsed?.error?.message ?? '';
    const reasons = [
      ...(parsed?.error?.errors?.map((e) => e.reason ?? '') ?? []),
      ...(parsed?.error?.details?.map((d) => d.reason ?? '') ?? []),
      parsed?.error?.status ?? '',
    ]
      .join(' ')
      .toLowerCase();

    if (
      reasons.includes('accessnotconfigured') ||
      reasons.includes('service_disabled') ||
      message.toLowerCase().includes('has not been used in project') ||
      message.toLowerCase().includes('api is disabled')
    ) {
      const projMatch = message.match(/project\s+(\d{6,})/i);
      const projectNumber = projMatch ? projMatch[1] : '1022597897742';
      throw new WorkspaceApiDisabledError(
        `Google API is not enabled or still propagating for this project: ${message || 'Enable Gmail API and Google Calendar API, wait 1–2 minutes, then retry.'}`,
        projectNumber
      );
    }

    if (
      res.status === 403 &&
      (reasons.includes('insufficientpermissions') ||
        reasons.includes('access_token_scope_insufficient') ||
        message.toLowerCase().includes('insufficient') ||
        message.toLowerCase().includes('scope'))
    ) {
      throw new WorkspaceAuthExpiredError(
        'Missing Gmail or Google Calendar permissions. Click "Connect Gmail & Calendar" and check ALL permission checkboxes ("Select all") on Google’s consent screen.'
      );
    }

    if (res.status === 401) {
      throw new WorkspaceAuthExpiredError(
        'Google authorization expired. Click "Connect Gmail & Calendar" to refresh your session.'
      );
    }

    throw new WorkspaceAuthExpiredError(
      message
        ? `Google permission required (${message}). Please reconnect your Google Account and check all permission boxes.`
        : 'Google authorization expired or missing required permission. Please reconnect Google Account.'
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Workspace API error (${res.status}): ${text.slice(0, 240)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listGmailMessages(input: {
  accessToken: string;
  query?: string;
  maxResults?: number;
}): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams();
  params.set('maxResults', String(Math.min(Math.max(input.maxResults ?? 12, 1), 25)));
  if (input.query?.trim()) {
    params.set('q', input.query.trim());
  }

  const listData = (await workspaceFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    input.accessToken
  )) as { messages?: Array<{ id?: string }> } | null;

  const ids = (listData?.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.map((id) =>
      workspaceFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        input.accessToken
      ).catch(() => null)
    )
  );

  return details
    .filter((d): d is Record<string, unknown> => Boolean(d))
    .map(parseGmailMessage);
}

export async function getGmailMessage(input: {
  accessToken: string;
  id: string;
}): Promise<GmailMessageSummary> {
  const raw = (await workspaceFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(input.id)}?format=full`,
    input.accessToken
  )) as Record<string, unknown>;
  return parseGmailMessage(raw);
}

function buildMimeRaw(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}): string {
  const safeSubject = input.subject.trim() || '(No Subject)';
  const encodedBody = encodeBase64Utf8(input.body || '');
  const chunkedBody = encodedBody.replace(/.{1,76}/g, '$&\r\n').trimEnd();
  const lines = [
    `To: ${input.to.trim()}`,
    `Subject: ${encodeRfc2047Subject(safeSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ];
  if (input.inReplyTo) {
    lines.push(`In-Reply-To: ${input.inReplyTo}`);
    lines.push(`References: ${input.inReplyTo}`);
  }
  lines.push('');
  lines.push(chunkedBody);
  return encodeBase64UrlUtf8(lines.join('\r\n'));
}

export async function createGmailDraft(input: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}): Promise<{ draftId: string; messageId?: string }> {
  const raw = buildMimeRaw(input);
  const res = (await workspaceFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    input.accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          raw,
          ...(input.threadId ? { threadId: input.threadId } : {}),
        },
      }),
    }
  )) as { id?: string; message?: { id?: string } };

  return {
    draftId: String(res?.id ?? ''),
    messageId: res?.message?.id,
  };
}

export async function sendGmailMessage(input: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}): Promise<{ id: string; threadId?: string }> {
  const raw = buildMimeRaw(input);
  const res = (await workspaceFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    input.accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw,
        ...(input.threadId ? { threadId: input.threadId } : {}),
      }),
    }
  )) as { id?: string; threadId?: string };

  return {
    id: String(res?.id ?? ''),
    threadId: res?.threadId,
  };
}

export async function listGoogleCalendarEvents(input: {
  accessToken: string;
  timeMin?: string;
  maxResults?: number;
}): Promise<GoogleCalendarEventItem[]> {
  const params = new URLSearchParams();
  params.set('singleEvents', 'true');
  params.set('orderBy', 'startTime');
  params.set('maxResults', String(Math.min(Math.max(input.maxResults ?? 20, 1), 50)));
  params.set(
    'timeMin',
    input.timeMin ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  );

  const data = (await workspaceFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    input.accessToken
  )) as { items?: Array<Record<string, unknown>> } | null;

  return (data?.items ?? []).map((ev) => {
    const startObj = (ev.start ?? {}) as { dateTime?: string; date?: string };
    const endObj = (ev.end ?? {}) as { dateTime?: string; date?: string };
    return {
      id: String(ev.id ?? ''),
      title: String(ev.summary ?? 'Untitled Event'),
      startTime: String(startObj.dateTime ?? startObj.date ?? new Date().toISOString()),
      endTime: endObj.dateTime ?? endObj.date,
      location: typeof ev.location === 'string' ? ev.location : undefined,
      description: typeof ev.description === 'string' ? ev.description : undefined,
      htmlLink: typeof ev.htmlLink === 'string' ? ev.htmlLink : undefined,
    };
  });
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
}): Promise<GoogleCalendarEventItem> {
  const parsedStart = new Date(input.startTime);
  const startIso = Number.isNaN(parsedStart.getTime())
    ? new Date().toISOString()
    : parsedStart.toISOString();
  const parsedEnd = input.endTime ? new Date(input.endTime) : null;
  const endIso =
    parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? parsedEnd.toISOString()
      : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();

  const created = (await workspaceFetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    input.accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: input.title,
        location: input.location,
        description: input.description,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
      }),
    }
  )) as Record<string, unknown>;

  const startObj = (created.start ?? {}) as { dateTime?: string; date?: string };
  const endObj = (created.end ?? {}) as { dateTime?: string; date?: string };

  return {
    id: String(created.id ?? ''),
    title: String(created.summary ?? input.title),
    startTime: String(startObj.dateTime ?? startObj.date ?? startIso),
    endTime: endObj.dateTime ?? endObj.date,
    location: typeof created.location === 'string' ? created.location : input.location,
    htmlLink: typeof created.htmlLink === 'string' ? created.htmlLink : undefined,
  };
}

export async function deleteGoogleCalendarEvent(input: {
  accessToken: string;
  eventId: string;
}): Promise<void> {
  await workspaceFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}`,
    input.accessToken,
    { method: 'DELETE' }
  );
}

interface GisOAuth2TokenResponse {
  access_token?: string;
  error?: string;
}

interface GisGlobal {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        hint?: string;
        prompt?: string;
        callback: (res: GisOAuth2TokenResponse) => void;
        error_callback?: (err: { type?: string }) => void;
      }) => {
        requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
      };
    };
  };
}

let gsiScriptPromise: Promise<boolean> | null = null;

function ensureGsiScriptLoaded(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  const win = window as unknown as { google?: GisGlobal };
  if (win.google?.accounts?.oauth2) {
    return Promise.resolve(true);
  }
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      window.setTimeout(() => {
        resolve(Boolean((window as unknown as { google?: GisGlobal }).google?.accounts?.oauth2));
      }, 1200);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    const timeout = window.setTimeout(() => resolve(false), 4000);
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve(Boolean((window as unknown as { google?: GisGlobal }).google?.accounts?.oauth2));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

export async function trySilentGoogleTokenRefresh(input: {
  clientId: string;
  scopes: readonly string[];
  loginHint?: string | null;
}): Promise<string | null> {
  if (!input.clientId || typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  const ready = await ensureGsiScriptLoaded();
  if (!ready) return null;

  const oauth2 = (window as unknown as { google?: GisGlobal }).google?.accounts?.oauth2;
  if (!oauth2) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(token);
    };

    const timer = window.setTimeout(() => finish(null), 5000);

    try {
      const client = oauth2.initTokenClient({
        client_id: input.clientId,
        scope: input.scopes.join(' '),
        hint: input.loginHint || undefined,
        prompt: '',
        callback: (res) => {
          if (res?.access_token && !res.error) {
            finish(res.access_token);
          } else {
            finish(null);
          }
        },
        error_callback: () => finish(null),
      });
      client.requestAccessToken({
        prompt: '',
        ...(input.loginHint ? { hint: input.loginHint } : {}),
      });
    } catch {
      finish(null);
    }
  });
}
