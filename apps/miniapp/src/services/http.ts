import Taro from '@tarojs/taro';
import { accessToken } from '../store/auth';

function genRequestId() {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `m-${ts}-${rnd}`;
}

export function apiBaseUrl() {
  const env = typeof process !== 'undefined' ? (process as any).env : undefined;
  const v = env?.TARO_APP_API_BASE_URL;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'http://localhost:3001';
}

export async function http<T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; data?: unknown },
) {
  const token = accessToken();
  const requestId = genRequestId();

  let res: Taro.request.SuccessCallbackResult<T>;
  try {
    res = await Taro.request<T>({
      url: `${apiBaseUrl()}${path}`,
      method: options?.method ?? 'GET',
      data: options?.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-request-id': requestId,
      },
    });
  } catch (e: any) {
    const msg =
      typeof e?.errMsg === 'string'
        ? e.errMsg
        : typeof e?.message === 'string'
          ? e.message
          : '网络请求失败';
    throw new Error(`${msg} (requestId=${requestId})`);
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data;
  }

  const rid = (res as any)?.header?.['x-request-id'] ?? (res as any)?.header?.['X-Request-Id'] ?? requestId;
  throw new Error(
    `${typeof res.data === 'string' ? res.data : `HTTP ${res.statusCode}`} (requestId=${rid})`,
  );
}
