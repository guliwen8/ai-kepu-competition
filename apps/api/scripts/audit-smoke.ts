import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

async function requestText(args: { baseUrl: string; path: string; method: string; token?: string }) {
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
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN ?? env.ADMIN_BOOTSTRAP_TOKEN ?? '';

  const adminPhone = process.env.SMOKE_PHONE ?? '13957512889';
  const code = process.env.SMOKE_CODE ?? '000000';
  const judgePhone = process.env.JUDGE_PHONE ?? `139${String(Date.now()).slice(-8)}`;
  const participantPhone = process.env.PARTICIPANT_PHONE ?? `138${String(Date.now()).slice(-8)}`;

  const login1 = await requestJson<{ accessToken: string; refreshToken: string }>({
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

  const adminLogin = await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: adminPhone, code },
  });

  const adminMe = await requestJson<{ id: string; roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: adminLogin.accessToken,
  });
  if (!adminMe.roles.includes('admin')) {
    throw new Error('当前 SMOKE_PHONE 用户不是 admin，请先配置 ADMIN_BOOTSTRAP_TOKEN 或使用已授予 admin 的手机号运行');
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
    body: { title: `audit-smoke-${randomUUID().slice(0, 8)}`, ...openWindows },
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: `/admin/competitions/${competition.id}/set-current`,
    method: 'POST',
    token: adminLogin.accessToken,
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: `/admin/competitions/${competition.id}`,
    method: 'PUT',
    token: adminLogin.accessToken,
    body: { theme: 'audit-smoke', ...openWindows },
  });

  await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone, code },
  });
  await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: participantPhone, code },
  });

  const grant = await requestJson<any>({
    baseUrl,
    path: '/admin/judging/judges/grant',
    method: 'POST',
    token: adminLogin.accessToken,
    body: { phone: judgePhone, realName: '评委A', orgName: '本地测试' },
  });

  const judgeLogin = await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone, code },
  });
  const judgeMe = await requestJson<{ id: string }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: judgeLogin.accessToken,
  });

  const participantLogin = await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: participantPhone, code },
  });
  const participantMe = await requestJson<{ id: string }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: participantLogin.accessToken,
  });

  const created = await requestJson<{ id: string }>({
    baseUrl,
    path: '/submissions',
    method: 'POST',
    token: participantLogin.accessToken,
    body: { category: 'VIDEO', title: `audit-sub-${randomUUID().slice(0, 8)}` },
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: `/submissions/${created.id}`,
    method: 'PUT',
    token: participantLogin.accessToken,
    body: { title: `audit-sub-upd-${randomUUID().slice(0, 8)}` },
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

  const team = await requestJson<{ id: string }>({
    baseUrl,
    path: '/teams',
    method: 'POST',
    token: participantLogin.accessToken,
    body: { name: `audit-team-${randomUUID().slice(0, 8)}` },
  });
  await requestJson<JsonValue>({
    baseUrl,
    path: `/teams/${team.id}/members`,
    method: 'POST',
    token: participantLogin.accessToken,
    body: { phone: judgePhone, role: 'member' },
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: '/admin/judging/assignments:batch',
    method: 'POST',
    token: adminLogin.accessToken,
    body: { submissionIds: [created.id], judgeIds: [judgeMe.id], ensureBlindCode: true },
  });

  const assignments = await requestJson<any>({
    baseUrl,
    path: `/admin/judging/assignments?page=1&pageSize=20&judgeId=${encodeURIComponent(judgeMe.id)}`,
    method: 'GET',
    token: adminLogin.accessToken,
  });
  const items = Array.isArray(assignments.items) ? assignments.items : [];
  const assignmentId = items.find((it: any) => it.submission?.id === created.id)?.id ?? items[0]?.id;
  if (!assignmentId) throw new Error('未找到分配任务');

  await requestJson<JsonValue>({
    baseUrl,
    path: `/admin/judging/assignments/${assignmentId}/revoke`,
    method: 'POST',
    token: adminLogin.accessToken,
  });

  async function assertAuditExists(args: {
    action: string;
    resourceType: string;
    resourceId?: string;
    actorUserId?: string;
    success?: boolean;
  }) {
    const qs = [
      `page=1`,
      `pageSize=50`,
      `sinceMinutes=10`,
      `action=${encodeURIComponent(args.action)}`,
      `resourceType=${encodeURIComponent(args.resourceType)}`,
      ...(args.resourceId ? [`resourceId=${encodeURIComponent(args.resourceId)}`] : []),
      ...(args.actorUserId ? [`actorUserId=${encodeURIComponent(args.actorUserId)}`] : []),
    ].join('&');
    const r = await requestJson<any>({
      baseUrl,
      path: `/admin/audit-logs?${qs}`,
      method: 'GET',
      token: adminLogin.accessToken,
    });
    const items = Array.isArray(r?.items) ? r.items : [];
    const matched = items.find(
      (it: any) =>
        it?.action === args.action &&
        it?.resourceType === args.resourceType &&
        (args.resourceId ? it?.resourceId === args.resourceId : true) &&
        (args.actorUserId ? it?.actorUserId === args.actorUserId : true) &&
        (typeof args.success === 'boolean' ? Boolean(it?.success) === args.success : true),
    );
    if (!matched) {
      throw new Error(
        `missing audit action: ${args.action} resourceType=${args.resourceType} resourceId=${args.resourceId ?? ''} actorUserId=${
          args.actorUserId ?? ''
        }`,
      );
    }
    if (!matched?.requestId) {
      throw new Error(`missing requestId in audit: ${args.action}`);
    }
  }

  for (const a of [
    { action: 'ADMIN_COMPETITION_CREATE', resourceType: 'Competition', resourceId: competition.id, actorUserId: adminMe.id },
    { action: 'ADMIN_COMPETITION_UPDATE', resourceType: 'Competition', resourceId: competition.id, actorUserId: adminMe.id },
    { action: 'ADMIN_COMPETITION_SET_CURRENT', resourceType: 'Competition', resourceId: competition.id, actorUserId: adminMe.id },
    { action: 'ADMIN_JUDGE_GRANT', resourceType: 'Judge', resourceId: grant?.userId ?? undefined, actorUserId: adminMe.id },
    { action: 'ADMIN_JUDGING_ASSIGN_BATCH', resourceType: 'JudgingAssignment', actorUserId: adminMe.id },
    { action: 'ADMIN_JUDGING_REVOKE', resourceType: 'JudgingAssignment', resourceId: assignmentId, actorUserId: adminMe.id },
    { action: 'PARTICIPANT_SUBMISSION_CREATE_DRAFT', resourceType: 'Submission', resourceId: created.id, actorUserId: participantMe.id },
    { action: 'PARTICIPANT_SUBMISSION_UPDATE_DRAFT', resourceType: 'Submission', resourceId: created.id, actorUserId: participantMe.id },
    { action: 'PARTICIPANT_SUBMISSION_UPLOAD_ATTACHMENT', resourceType: 'Submission', resourceId: created.id, actorUserId: participantMe.id },
    { action: 'PARTICIPANT_SUBMISSION_SUBMIT', resourceType: 'Submission', resourceId: created.id, actorUserId: participantMe.id },
    { action: 'PARTICIPANT_TEAM_CREATE', resourceType: 'Team', resourceId: team.id, actorUserId: participantMe.id },
    { action: 'PARTICIPANT_TEAM_ADD_MEMBER', resourceType: 'Team', resourceId: team.id, actorUserId: participantMe.id },
  ]) {
    await assertAuditExists({ ...a, success: true });
  }

  const csv = await requestText({
    baseUrl,
    path: '/admin/audit-logs/export',
    method: 'GET',
    token: adminLogin.accessToken,
  });
  if (csv.includes(judgePhone)) throw new Error('audit export leaks judge phone');
  if (csv.includes('评委A')) throw new Error('audit export leaks judge realName');

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        adminPhone,
        judgePhone,
        participantPhone,
        competitionId: competition.id,
        grantUserId: grant?.userId ?? null,
        assignmentId,
        submissionId: created.id,
        teamId: team.id,
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
