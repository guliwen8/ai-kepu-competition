import { getTokens, clearTokens } from './auth';

function baseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init?.headers);
  if (
    !headers.has('x-request-id') &&
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    headers.set('x-request-id', crypto.randomUUID());
  }
  headers.set('Content-Type', 'application/json');
  if (tokens?.accessToken) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
  });

  const requestId = res.headers.get('x-request-id') ?? headers.get('x-request-id');

  if (res.status === 401) {
    clearTokens();
  }

  if (!res.ok) {
    const text = await res.text();
    const msg = text || `HTTP ${res.status}`;
    throw new Error(requestId ? `${msg} (requestId=${requestId})` : msg);
  }

  return (await res.json()) as T;
}
