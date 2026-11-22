const RAW_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');

export function isRemoteApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
}
