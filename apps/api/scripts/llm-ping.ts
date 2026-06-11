import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function loadDotEnv(): { loaded: boolean; path?: string } {
  let dir = process.cwd();
  let text = '';
  let loadedPath: string | undefined;
  for (let i = 0; i < 6; i++) {
    const p = resolve(dir, '.env');
    try {
      text = readFileSync(p, 'utf8');
      loadedPath = p;
      dir = dirname(dir);
    } catch {
      dir = dirname(dir);
    }
  }
  if (!text) return { loaded: false };

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
    if (process.env[key] == null) process.env[key] = value;
  }
  return { loaded: true, path: loadedPath };
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function safeParseJson<T>(text: string): T | null {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function extractJsonTag(text: string): string | null {
  const m = String(text ?? '').match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
  return m?.[1] ? String(m[1]).trim() : null;
}

function parseJsonLoose(text: string): any | null {
  const direct = safeParseJson<any>(text);
  if (direct) return direct;
  const relaxed = String(text ?? '')
    .trim()
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n');
  return safeParseJson<any>(relaxed);
}

async function main() {
  const dot = loadDotEnv();

  const provider = (process.env.LLM_PROVIDER ?? 'none').toLowerCase();
  if (provider !== 'openai_compatible') {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: 'LLM_PROVIDER is not openai_compatible',
          cwd: process.cwd(),
          dotenv: dot ?? { loaded: false },
          provider: process.env.LLM_PROVIDER ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  const baseUrl = requiredEnv('LLM_BASE_URL').replace(/\/+$/, '');
  const apiKey = requiredEnv('LLM_API_KEY');

  if (apiKey === 'changeme' || baseUrl.includes('api.example.com')) {
    throw new Error('请在 .env 中配置真实的 LLM_BASE_URL / LLM_API_KEY');
  }

  const model =
    process.env.LLM_MODEL ?? (baseUrl.includes('minimaxi.com') ? 'MiniMax-M2.7' : 'gpt-4o-mini');
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? '8000');
  const chatPath = (process.env.LLM_CHAT_PATH ?? '/chat/completions').startsWith('/')
    ? (process.env.LLM_CHAT_PATH ?? '/chat/completions')
    : `/${process.env.LLM_CHAT_PATH ?? 'chat/completions'}`;
  const apiKeyHeader = process.env.LLM_API_KEY_HEADER ?? 'Authorization';
  const apiKeyPrefix = (process.env.LLM_API_KEY_PREFIX ?? 'Bearer').trim();

  const url = `${baseUrl}${chatPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKeyHeader.toLowerCase() === 'authorization') {
      headers[apiKeyHeader] = apiKeyPrefix ? `${apiKeyPrefix} ${apiKey}` : apiKey;
    } else {
      headers[apiKeyHeader] = apiKey;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '只输出一个 <json>...</json> 包裹的 JSON 对象，不要输出任何额外文字或思考过程。' },
          {
            role: 'user',
            content: JSON.stringify(
              {
                task: 'ping',
                output: { pong: true },
                rule: '请只输出 <json>{"pong":true}</json>',
              },
              null,
              2,
            ),
          },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    const tag = extractJsonTag(text);
    const parsed = tag ? parseJsonLoose(tag) : null;
    const json = safeParseJson<any>(text);
    const content = json?.choices?.[0]?.message?.content;

    console.log(
      JSON.stringify(
        {
          ok: res.ok,
          status: res.status,
          url,
          model,
          hasChoices: Array.isArray(json?.choices),
          bodyPreview: text ? text.slice(0, 500) : null,
          contentPreview: typeof content === 'string' ? content.slice(0, 200) : null,
          jsonTagPreview: tag ? tag.slice(0, 200) : null,
          parsedFromTag: parsed ?? null,
        },
        null,
        2,
      ),
    );

    if (!res.ok) {
      const modelsUrl = `${baseUrl}/models`;
      try {
        const mRes = await fetch(modelsUrl, { headers, method: 'GET', signal: controller.signal });
        const mText = await mRes.text();
        const mJson = safeParseJson<any>(mText);
        const ids = Array.isArray(mJson?.data)
          ? mJson.data.map((x: any) => x?.id).filter(Boolean).slice(0, 20)
          : [];
        console.log(
          JSON.stringify(
            {
              modelsOk: mRes.ok,
              modelsStatus: mRes.status,
              modelsUrl,
              modelIdsPreview: ids.length ? ids : null,
              modelsBodyPreview: mText ? mText.slice(0, 500) : null,
            },
            null,
            2,
          ),
        );
      } catch {
        console.log(JSON.stringify({ modelsOk: false, modelsUrl }, null, 2));
      }
      process.exit(1);
    }
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
