import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function loadEnv(): Record<string, string> {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const p = resolve(dir, '.env');
    try {
      const text = readFileSync(p, 'utf8');
      const out: Record<string, string> = {};
      for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        out[key] = value;
      }
      return out;
    } catch {
      dir = dirname(dir);
    }
  }
  return {};
}

async function readJson<T extends JsonValue>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text);
  }
}

async function requestJson<T extends JsonValue>(args: {
  baseUrl: string;
  path: string;
  method: string;
  token?: string;
  body?: unknown;
}): Promise<T> {
  const res = await fetch(`${args.baseUrl}${args.path}`, {
    method: args.method,
    headers: {
      'Content-Type': 'application/json',
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
    },
    body: args.body != null ? JSON.stringify(args.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${args.method} ${args.path} -> ${res.status} ${text}`);
  }
  return readJson<T>(res);
}

async function main() {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const env = loadEnv();
  const bootstrapToken =
    process.env.ADMIN_BOOTSTRAP_TOKEN ?? env.ADMIN_BOOTSTRAP_TOKEN ?? '';

  const phone = process.env.SMOKE_PHONE ?? '13957512889';
  const code = process.env.SMOKE_CODE ?? '000000';

  const login1 = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone, code },
  });

  let boot: JsonValue = null;
  if (bootstrapToken && bootstrapToken !== 'changeme') {
    boot = await requestJson<JsonValue>({
      baseUrl,
      path: '/admin/bootstrap',
      method: 'POST',
      token: login1.accessToken,
      body: { token: bootstrapToken },
    });
  }

  const login2 = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone, code },
  });

  const me = await requestJson<{ roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: login2.accessToken,
  });
  if (!me.roles.includes('admin')) {
    throw new Error(
      '当前用户不是 admin，请先配置 ADMIN_BOOTSTRAP_TOKEN 或使用已授予 admin 的手机号运行',
    );
  }

  const list = await requestJson<JsonValue>({
    baseUrl,
    path: '/admin/submissions?page=1&pageSize=5',
    method: 'GET',
    token: login2.accessToken,
  });

  const items = Array.isArray((list as any)?.items)
    ? ((list as any).items as any[])
    : [];
  const firstId = items[0]?.id;
  const detail = firstId
    ? await requestJson<JsonValue>({
        baseUrl,
        path: `/admin/submissions/${firstId}`,
        method: 'GET',
        token: login2.accessToken,
      })
    : null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        phone,
        bootstrapped: !!boot,
        roles: me.roles,
        listed: items.length,
        firstId: firstId ?? null,
        detailHasLatestReview: Boolean((detail as any)?.latestReview),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
