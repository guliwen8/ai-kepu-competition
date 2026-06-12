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
  const code = process.env.SMOKE_CODE ?? '000000';
  const judgePhone1 =
    process.env.JUDGE_PHONE ?? `139${String(Date.now()).slice(-8)}`;
  const judgePhone2 =
    process.env.JUDGE_PHONE_2 ?? `137${String(Date.now()).slice(-8)}`;
  const participantPhone =
    process.env.PARTICIPANT_PHONE ?? `138${String(Date.now()).slice(-8)}`;

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

  await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone1, code },
  });
  await requestJson<{ accessToken: string; refreshToken: string }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone2, code },
  });

  await requestJson<JsonValue>({
    baseUrl,
    path: '/admin/judging/judges/grant',
    method: 'POST',
    token: adminLogin.accessToken,
    body: { phone: judgePhone1, realName: '评委A', orgName: '本地测试' },
  });
  await requestJson<JsonValue>({
    baseUrl,
    path: '/admin/judging/judges/grant',
    method: 'POST',
    token: adminLogin.accessToken,
    body: { phone: judgePhone2, realName: '评委B', orgName: '本地测试' },
  });

  const judgeLogin1 = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone1, code },
  });
  const judgeLogin2 = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>({
    baseUrl,
    path: '/auth/login/sms',
    method: 'POST',
    body: { phone: judgePhone2, code },
  });

  const judgeMe1 = await requestJson<{ id: string; roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: judgeLogin1.accessToken,
  });
  const judgeMe2 = await requestJson<{ id: string; roles: string[] }>({
    baseUrl,
    path: '/auth/me',
    method: 'GET',
    token: judgeLogin2.accessToken,
  });

  const current = await requestJson<{ id: string; title: string } | null>({
    baseUrl,
    path: '/admin/competitions/current',
    method: 'GET',
    token: adminLogin.accessToken,
  });

  const openWindows = {
    submissionStart: isoOffset(-60 * 60 * 1000),
    submissionEnd: isoOffset(60 * 60 * 1000),
    judgingStart: isoOffset(-60 * 60 * 1000),
    judgingEnd: isoOffset(60 * 60 * 1000),
    publicStart: isoOffset(-60 * 60 * 1000),
    publicEnd: isoOffset(60 * 60 * 1000),
  };

  const competitionId =
    current?.id ??
    (
      await requestJson<{ id: string }>({
        baseUrl,
        path: '/admin/competitions',
        method: 'POST',
        token: adminLogin.accessToken,
        body: {
          title: `ranking-smoke-${randomUUID().slice(0, 8)}`,
          ...openWindows,
        },
      })
    ).id;

  if (!current?.id) {
    await requestJson<JsonValue>({
      baseUrl,
      path: `/admin/competitions/${competitionId}/set-current`,
      method: 'POST',
      token: adminLogin.accessToken,
    });
  }

  await requestJson<JsonValue>({
    baseUrl,
    path: `/admin/competitions/${competitionId}`,
    method: 'PUT',
    token: adminLogin.accessToken,
    body: openWindows,
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

  async function createSubmission(title: string) {
    const created = await requestJson<{ id: string }>({
      baseUrl,
      path: '/submissions',
      method: 'POST',
      token: participantLogin.accessToken,
      body: { category: 'VIDEO', title },
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

    return created.id;
  }

  const submissionA = await createSubmission(
    `ranking-A-${randomUUID().slice(0, 8)}`,
  );
  const submissionB = await createSubmission(
    `ranking-B-${randomUUID().slice(0, 8)}`,
  );
  const submissionC = await createSubmission(
    `ranking-C-${randomUUID().slice(0, 8)}`,
  );

  const assign = await requestJson<{ createdCount: number; skipped: any[] }>({
    baseUrl,
    path: '/admin/judging/assignments:batch',
    method: 'POST',
    token: adminLogin.accessToken,
    body: {
      submissionIds: [submissionA, submissionB, submissionC],
      judgeIds: [judgeMe1.id, judgeMe2.id],
      ensureBlindCode: true,
      mode: 'cross',
    },
  });
  if (assign.createdCount === 0) {
    const first = assign.skipped?.[0];
    throw new Error(`分配未创建任务：${first?.reason ?? 'unknown'}`);
  }

  const tasks1 = await requestJson<any[]>({
    baseUrl,
    path: '/judge/judging/assignments',
    method: 'GET',
    token: judgeLogin1.accessToken,
  });
  const tasks2 = await requestJson<any[]>({
    baseUrl,
    path: '/judge/judging/assignments',
    method: 'GET',
    token: judgeLogin2.accessToken,
  });

  function findAssignmentId(tasks: any[], submissionId: string) {
    return tasks.find((t) => t.submission?.id === submissionId)?.id;
  }

  const a1 = findAssignmentId(tasks1, submissionA);
  const b1 = findAssignmentId(tasks1, submissionB);
  const c1 = findAssignmentId(tasks1, submissionC);
  const a2 = findAssignmentId(tasks2, submissionA);
  const b2 = findAssignmentId(tasks2, submissionB);
  const c2 = findAssignmentId(tasks2, submissionC);

  if (!a1 || !b1 || !c1 || !a2 || !b2 || !c2)
    throw new Error('评委侧未查询到完整分配任务');

  async function scoreAndSubmit(
    token: string,
    assignmentId: string,
    s: { s1: number; s2: number; s3: number; s4: number; s5: number },
  ) {
    await requestJson<JsonValue>({
      baseUrl,
      path: `/judge/judging/assignments/${assignmentId}/score`,
      method: 'PUT',
      token,
      body: { ...s, comment: 'ranking smoke' },
    });
    await requestJson<JsonValue>({
      baseUrl,
      path: `/judge/judging/assignments/${assignmentId}/submit`,
      method: 'POST',
      token,
    });
  }

  await scoreAndSubmit(judgeLogin1.accessToken, a1, {
    s1: 10,
    s2: 10,
    s3: 10,
    s4: 10,
    s5: 10,
  });
  await scoreAndSubmit(judgeLogin2.accessToken, a2, {
    s1: 10,
    s2: 10,
    s3: 10,
    s4: 10,
    s5: 10,
  });

  await scoreAndSubmit(judgeLogin1.accessToken, b1, {
    s1: 8,
    s2: 8,
    s3: 8,
    s4: 8,
    s5: 8,
  });
  await scoreAndSubmit(judgeLogin2.accessToken, b2, {
    s1: 8,
    s2: 8,
    s3: 8,
    s4: 8,
    s5: 8,
  });

  await scoreAndSubmit(judgeLogin1.accessToken, c1, {
    s1: 10,
    s2: 10,
    s3: 10,
    s4: 10,
    s5: 10,
  });
  await requestJson<JsonValue>({
    baseUrl,
    path: `/judge/judging/assignments/${c2}/score`,
    method: 'PUT',
    token: judgeLogin2.accessToken,
    body: {
      s1: 10,
      s2: 10,
      s3: 10,
      s4: 10,
      s5: 10,
      comment: 'ranking smoke (not submitted)',
    },
  });

  for (const id of [submissionA, submissionB, submissionC]) {
    await requestJson<JsonValue>({
      baseUrl,
      path: `/admin/submissions/${id}/publicize`,
      method: 'POST',
      token: adminLogin.accessToken,
    });
  }

  await requestText({
    baseUrl,
    path: '/admin/publications/export?category=VIDEO',
    method: 'GET',
    token: adminLogin.accessToken,
  });

  const lb = await requestJson<any>({
    baseUrl,
    path: '/public/leaderboard?category=VIDEO&page=1&pageSize=50',
    method: 'GET',
  });
  const items = Array.isArray(lb.items) ? lb.items : [];

  if (items.length < 3)
    throw new Error(`leaderboard items expected >= 3, got ${items.length}`);

  const idToRank = new Map(items.map((x: any) => [x.submissionId, x.rank]));
  const rA = idToRank.get(submissionA);
  const rB = idToRank.get(submissionB);
  const rC = idToRank.get(submissionC);
  if (!rA || !rB || !rC)
    throw new Error('leaderboard missing expected submissions');
  if (!(rA < rC && rC < rB))
    throw new Error(`unexpected ranking order: A=${rA} C=${rC} B=${rB}`);

  for (let i = 1; i < items.length; i += 1) {
    const a = items[i - 1];
    const b = items[i];
    if (a.score.avgTotal < b.score.avgTotal)
      throw new Error('leaderboard not sorted by avgTotal desc');
    if (
      a.score.avgTotal === b.score.avgTotal &&
      a.score.scoreCount < b.score.scoreCount
    ) {
      throw new Error(
        'leaderboard not sorted by scoreCount desc when avgTotal ties',
      );
    }
  }

  const blob = JSON.stringify(lb);
  for (const k of [
    'ownerId',
    'members',
    'phone',
    'username',
    'realName',
    'teacherName',
    'teacherContact',
    'originalName',
    'storedPath',
  ]) {
    if (blob.includes(`"${k}"`))
      throw new Error(`public leaderboard leaks sensitive field: ${k}`);
  }

  const detail = await requestJson<any>({
    baseUrl,
    path: `/public/submissions/${submissionA}`,
    method: 'GET',
  });
  const detailBlob = JSON.stringify(detail);
  for (const k of [
    'originalName',
    'storedPath',
    'ownerId',
    'teacherName',
    'teacherContact',
  ]) {
    if (detailBlob.includes(`"${k}"`))
      throw new Error(`public submission detail leaks sensitive field: ${k}`);
  }

  const audit = await requestJson<any>({
    baseUrl,
    path: '/admin/audit-logs?page=1&pageSize=50',
    method: 'GET',
    token: adminLogin.accessToken,
  });
  const auditBlob = JSON.stringify(audit);
  for (const k of ['ADMIN_SUBMISSION_PUBLICIZE', 'ADMIN_PUBLICATION_EXPORT']) {
    if (!auditBlob.includes(k)) throw new Error(`missing audit action: ${k}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        adminPhone,
        judgePhone1,
        judgePhone2,
        participantPhone,
        competitionId,
        submissions: { submissionA, submissionB, submissionC },
        ranks: { A: rA, C: rC, B: rB },
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
