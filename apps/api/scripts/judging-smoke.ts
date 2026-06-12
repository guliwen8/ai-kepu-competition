import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

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

async function requestText(args: {
  baseUrl: string;
  path: string;
  method: string;
  token?: string;
}) {
  const res = await fetch(`${args.baseUrl}${args.path}`, {
    method: args.method,
    headers: {
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${args.method} ${args.path} -> ${res.status} ${text}`);
  }
  return res.text();
}

function isoOffset(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

async function main() {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const env = loadEnv();
  const bootstrapToken =
    process.env.ADMIN_BOOTSTRAP_TOKEN ?? env.ADMIN_BOOTSTRAP_TOKEN ?? '';

  const adminPhone = process.env.SMOKE_PHONE ?? '13957512889';
  const judgePhone =
    process.env.JUDGE_PHONE ?? `139${String(Date.now()).slice(-8)}`;
  const participantPhone =
    process.env.PARTICIPANT_PHONE ?? `138${String(Date.now()).slice(-8)}`;
  const code = process.env.SMOKE_CODE ?? '000000';

  const login1 = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: adminPhone, code },
  });

  if (bootstrapToken && bootstrapToken !== 'changeme') {
    await requestJson<JsonValue>({
      baseUrl,
      path: '/admin/bootstrap',
      method: 'POST',
      token: login1.accessToken,
      body: { token: bootstrapToken },
    });
  }

  const adminLogin = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: adminPhone, code },
  });

  await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone, code },
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: '/admin/judging/judges/grant',
    method: 'POST',
    token: adminLogin.accessToken,
    body: { phone: judgePhone, realName: '评委A', orgName: '本地测试' },
  });

  const judgeLogin = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone, code },
  });

  const adminMe = await requestJson<{ id: string; roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: adminLogin.accessToken,
  });
  if (!adminMe.roles.includes('admin')) {
    throw new Error(
      '当前 SMOKE_PHONE 用户不是 admin，请先在后台授予 admin 或提供可用的 ADMIN_BOOTSTRAP_TOKEN',
    );
  }

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
    token: adminLogin.accessToken,
    body: {
      title: `judging-smoke-${randomUUID().slice(0, 8)}`,
      ...openWindows,
    },
  });
  await requestJson<JsonValue>({
    baseUrl,
    path: `/admin/competitions/${competition.id}/set-current`,
    method: 'POST',
    token: adminLogin.accessToken,
  });

  const me = await requestJson<{ id: string; roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: judgeLogin.accessToken,
  });

  const participantLogin = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: participantPhone, code },
  });

  const created = await requestJson<{ id: string }>({
    baseUrl,
    path: '/submissions',
    method: 'POST',
    token: participantLogin.accessToken,
    body: {
      category: 'VIDEO',
      title: `judging-smoke-${randomUUID().slice(0, 8)}`,
    },
  });

  const buf = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const form = new FormData();
  form.set('durationSec', '120');
  form.set('file', new Blob([buf], { type: 'video/mp4' }), 'demo.mp4');

  await requestMultipart({
    baseUrl,
    path: `/submissions/${created.id}/attachments/VIDEO`,
    method: 'POST',
    token: participantLogin.accessToken,
    form,
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: `/submissions/${created.id}/submit`,
    method: 'POST',
    token: participantLogin.accessToken,
  });

  const submissionId = created.id;

  const assign = await requestJson<{ createdCount: number; skipped: any[] }>({
    baseUrl,
    path: '/admin/judging/assignments:batch',
    method: 'POST',
    token: adminLogin.accessToken,
    body: {
      submissionIds: [submissionId],
      judgeIds: [me.id],
      ensureBlindCode: true,
      mode: 'cross',
    },
  });
  if (assign.createdCount === 0) {
    const first = assign.skipped?.[0];
    throw new Error(`分配未创建任务：${first?.reason ?? 'unknown'}`);
  }

  const tasks = await requestJson<any[]>({
    baseUrl,
    path: '/judge/judging/assignments',
    method: 'GET',
    token: judgeLogin.accessToken,
  });

  const firstAttachments = tasks?.[0]?.submission?.attachments ?? [];
  const blindOk = firstAttachments.every(
    (a: any) => !Object.prototype.hasOwnProperty.call(a, 'originalName'),
  );

  const assignmentId =
    tasks.find((t) => t.submission?.id === submissionId)?.id ?? tasks[0]?.id;
  if (!assignmentId) throw new Error('评委侧未查询到分配任务');

  const score = await requestJson<JsonValue>({
    baseUrl,
    path: `/judge/judging/assignments/${assignmentId}/score`,
    method: 'PUT',
    token: judgeLogin.accessToken,
    body: { s1: 8, s2: 7, s3: 9, s4: 6, s5: 8, comment: '测试评语' },
  });

  const submitted = await requestJson<JsonValue>({
    baseUrl,
    path: `/judge/judging/assignments/${assignmentId}/submit`,
    method: 'POST',
    token: judgeLogin.accessToken,
  });

  const csv = await requestText({
    baseUrl,
    path: '/admin/judging/export?submittedOnly=0',
    method: 'GET',
    token: adminLogin.accessToken,
  });

  const hasLine = csv.includes(submissionId) && csv.includes(me.id);

  const audit = await requestJson<any>({
    baseUrl,
    path: '/admin/audit-logs?page=1&pageSize=50',
    method: 'GET',
    token: adminLogin.accessToken,
  });
  const auditBlob = JSON.stringify(audit);
  for (const k of [
    'ADMIN_JUDGE_GRANT',
    'ADMIN_JUDGING_ASSIGN_BATCH',
    'JUDGE_ASSIGNMENT_SCORE',
    'JUDGE_ASSIGNMENT_SUBMIT',
    'ADMIN_JUDGING_EXPORT',
  ]) {
    if (!auditBlob.includes(k)) throw new Error(`missing audit action: ${k}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        adminPhone,
        judgePhone,
        judgeRoles: me.roles,
        submissionId,
        assignmentId,
        createdCount: assign.createdCount,
        skipped: assign.skipped.length,
        blindOk,
        scored: Boolean(score),
        submitted: Boolean(submitted),
        exportOk: hasLine,
        auditOk: true,
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
