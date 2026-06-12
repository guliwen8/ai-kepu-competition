import { randomUUID } from 'node:crypto';
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

async function requestMultipart<T extends JsonValue>(args: {
  baseUrl: string;
  path: string;
  method: string;
  token: string;
  form: FormData;
}): Promise<T> {
  const res = await fetch(`${args.baseUrl}${args.path}`, {
    method: args.method,
    headers: {
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
    },
    body: args.form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${args.method} ${args.path} -> ${res.status} ${text}`);
  }
  return readJson<T>(res);
}

function findTask(latest: any, type: string): any | null {
  const tasks = Array.isArray(latest?.tasks) ? latest.tasks : [];
  return tasks.find((t: any) => t?.type === type) ?? null;
}

function isoOffset(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

async function main() {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const env = loadEnv();
  const bootstrapToken =
    process.env.ADMIN_BOOTSTRAP_TOKEN ?? env.ADMIN_BOOTSTRAP_TOKEN ?? '';
  const adminPhone =
    process.env.SMOKE_ADMIN_PHONE ?? process.env.SMOKE_PHONE ?? '13957512889';
  const phone =
    process.env.SMOKE_PARTICIPANT_PHONE ?? `139${String(Date.now()).slice(-8)}`;
  const code = process.env.SMOKE_CODE ?? '000000';

  const adminLogin0 = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: adminPhone, code },
  });

  const adminInitialToken = adminLogin0.accessToken;
  const initialMe = await requestJson<{ roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: adminInitialToken,
  });

  let adminToken: string | null = null;
  if (bootstrapToken && bootstrapToken !== 'changeme') {
    await requestJson<JsonValue>({
      baseUrl,
      path: '/admin/bootstrap',
      method: 'POST',
      token: adminInitialToken,
      body: { token: bootstrapToken },
    });
    const adminLogin = await requestJson<{
      accessToken: string;
      refreshToken: string;
    }>({
      baseUrl,
      path: '/auth/login/sms',
      method: 'POST',
      body: { phone: adminPhone, code },
    });
    const me = await requestJson<{ roles: string[] }>({
      baseUrl,
      path: '/auth/me',
      method: 'GET',
      token: adminLogin.accessToken,
    });
    if (!me.roles.includes('admin')) {
      throw new Error(
        '当前 SMOKE_PHONE 用户不是 admin，请先配置 ADMIN_BOOTSTRAP_TOKEN 或使用已授予 admin 的手机号运行',
      );
    }
    adminToken = adminLogin.accessToken;
  } else if (initialMe.roles.includes('admin')) {
    adminToken = adminInitialToken;
  }

  if (adminToken) {
    const openWindows = {
      submissionStart: isoOffset(-60 * 60 * 1000),
      submissionEnd: isoOffset(60 * 60 * 1000),
      judgingStart: isoOffset(-60 * 60 * 1000),
      judgingEnd: isoOffset(60 * 60 * 1000),
      publicStart: isoOffset(-60 * 60 * 1000),
      publicEnd: isoOffset(60 * 60 * 1000),
    };
    const competition = await requestJson<{ id: string }>({
      baseUrl,
      path: '/admin/competitions',
      method: 'POST',
      token: adminToken,
      body: { title: `smoke-${randomUUID().slice(0, 8)}`, ...openWindows },
    });
    await requestJson<JsonValue>({
      baseUrl,
      path: `/admin/competitions/${competition.id}/set-current`,
      method: 'POST',
      token: adminToken,
    });
  }

  const login = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone, code },
  });

  const token = login.accessToken;

  const currentCompetition = await requestJson<JsonValue>({
    baseUrl,
    path: '/competitions/current',
    method: 'GET',
  });
  if (
    currentCompetition !== null &&
    (typeof currentCompetition !== 'object' ||
      Array.isArray(currentCompetition))
  ) {
    throw new Error('GET /competitions/current invalid response');
  }

  const runOne = async (args: {
    title: string;
    expectAnonStatus: 'PASS' | 'FAIL' | 'NEED_MANUAL';
    expectContentStatus?: 'PASS' | 'FAIL' | 'NEED_MANUAL' | 'MISSING';
  }) => {
    const submission = await requestJson<{
      id: string;
      status: string;
      category: string;
    }>({
      baseUrl,
      path: '/submissions',
      method: 'POST',
      token,
      body: { category: 'VIDEO', title: args.title },
    });

    const buf = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const form = new FormData();
    form.set('durationSec', '120');
    form.set('file', new Blob([buf], { type: 'video/mp4' }), 'demo.mp4');

    await requestMultipart({
      baseUrl,
      path: `/submissions/${submission.id}/attachments/VIDEO`,
      method: 'POST',
      token,
      form,
    });

    const review = await requestJson<JsonValue>({
      baseUrl,
      path: `/submissions/${submission.id}/submit`,
      method: 'POST',
      token,
    });

    const latest = await requestJson<JsonValue>({
      baseUrl,
      path: `/reviews/submissions/${submission.id}/latest`,
      method: 'GET',
      token,
    });

    const anon = findTask(latest, 'ANONYMITY');
    if (!anon) throw new Error('ANONYMITY task missing');
    if (anon.status !== args.expectAnonStatus) {
      throw new Error(
        `ANONYMITY expected ${args.expectAnonStatus} got ${String(anon.status)}`,
      );
    }

    const content = findTask(latest, 'CONTENT');
    if (args.expectContentStatus) {
      if (args.expectContentStatus === 'MISSING') {
        if (content) throw new Error('CONTENT task should be missing');
      } else {
        if (!content) throw new Error('CONTENT task missing');
        if (content.status !== args.expectContentStatus) {
          throw new Error(
            `CONTENT expected ${args.expectContentStatus} got ${String(content.status)}`,
          );
        }
      }
    }

    return { submissionId: submission.id, review, latest };
  };

  const okCase = await runOne({
    title: `smoke-${randomUUID().slice(0, 8)}`,
    expectAnonStatus: 'PASS',
    expectContentStatus: 'PASS',
  });

  const contentFailCase = await runOne({
    title: `smoke-content-炸弹-${randomUUID().slice(0, 6)}`,
    expectAnonStatus: 'PASS',
    expectContentStatus: 'FAIL',
  });

  const anonFailCase = await runOne({
    title: `smoke-anon-phone-13912345678-${randomUUID().slice(0, 6)}`,
    expectAnonStatus: 'FAIL',
    expectContentStatus: 'MISSING',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        phone,
        adminPhone,
        currentCompetition,
        okCase,
        contentFailCase,
        anonFailCase,
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
