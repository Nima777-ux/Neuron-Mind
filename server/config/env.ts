export interface ServerConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string | undefined;
  geminiModel: string;
  firebaseProjectId: string | undefined;
  allowedOrigins: string[];
}

const DEFAULT_NATIVE_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:3000',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
];

export function getServerConfig(): ServerConfig {
  const rawKey = process.env.GEMINI_API_KEY?.trim();
  const geminiApiKey =
    rawKey && rawKey !== 'MY_GEMINI_API_KEY' ? rawKey : undefined;

  const parsedPort = Number.parseInt(process.env.PORT ?? '3000', 10);

  const originSet = new Set<string>(DEFAULT_NATIVE_ORIGINS);
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && appUrl !== 'MY_APP_URL') {
    try {
      originSet.add(new URL(appUrl).origin);
    } catch {
      originSet.add(appUrl.replace(/\/+$/, ''));
    }
  }

  const extraOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  for (const item of extraOrigins) {
    const clean = item.trim().replace(/\/+$/, '');
    if (clean) originSet.add(clean);
  }

  return {
    port: Number.isFinite(parsedPort) ? parsedPort : 3000,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    geminiApiKey,
    geminiModel: 'gemini-4-hydrogen',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined,
    allowedOrigins: Array.from(originSet),
  };
}
