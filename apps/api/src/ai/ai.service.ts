import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnonymityFinding } from '../reviews/anonymity-rules';
import type { ContentFinding } from '../reviews/content-types';

type LlmAnonymityResponse = {
  status: 'PASS' | 'FAIL' | 'NEED_MANUAL';
  findings: Array<{
    code: string;
    message: string;
    field?: string;
    evidence?: string;
    confidence?: number;
  }>;
};

type LlmContentResponse = {
  status: 'PASS' | 'FAIL' | 'NEED_MANUAL';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  findings: Array<{
    code: string;
    message: string;
    field?: string;
    evidence?: string;
    confidence?: number;
    suggestion?: 'PASS' | 'NEED_FIX' | 'NEED_MANUAL';
  }>;
};

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigService) {}

  async extractContentRisk(args: {
    chunks: Array<{ field: string; text: string }>;
  }): Promise<{
    status: 'PASS' | 'FAIL' | 'NEED_MANUAL';
    findings: ContentFinding[];
  }> {
    const provider = (
      this.configService.get<string>('LLM_PROVIDER') ?? 'none'
    ).toLowerCase();
    if (provider !== 'openai_compatible') {
      return { status: 'PASS', findings: [] };
    }

    const baseUrl = this.configService.get<string>('LLM_BASE_URL') ?? '';
    const apiKey = this.configService.get<string>('LLM_API_KEY') ?? '';
    const model =
      this.configService.get<string>('LLM_MODEL') ??
      (baseUrl.includes('minimaxi.com') ? 'MiniMax-M2.7' : 'gpt-4o-mini');
    const timeoutMs = Number(
      this.configService.get<string>('LLM_TIMEOUT_MS') ?? '8000',
    );
    const apiKeyHeader =
      this.configService.get<string>('LLM_API_KEY_HEADER') ?? 'Authorization';
    const apiKeyPrefix =
      this.configService.get<string>('LLM_API_KEY_PREFIX') ?? 'Bearer';
    const chatPath =
      this.configService.get<string>('LLM_CHAT_PATH') ?? '/chat/completions';

    if (
      !baseUrl ||
      !apiKey ||
      apiKey === 'changeme' ||
      baseUrl.includes('api.example.com')
    ) {
      return { status: 'PASS', findings: [] };
    }

    const content = await this.openAiCompatibleChatJson({
      baseUrl,
      apiKey,
      apiKeyHeader,
      apiKeyPrefix,
      chatPath,
      model,
      timeoutMs,
      messages: [
        {
          role: 'system',
          content:
            '你是大赛作品内容初审助手。只输出一个 <json>...</json> 包裹的 JSON 对象，不要输出任何额外文字或思考过程。对输入内容给出风险判断与结构化 findings，重点关注：违法违规引导、谣言或伪科学误导、伦理风险、敏感信息泄露、明显不当内容等。',
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              task: 'content_precheck',
              input: args.chunks.map((c) => ({
                field: c.field,
                text: c.text.slice(0, 1200),
              })),
              output_schema: {
                status: 'PASS|FAIL|NEED_MANUAL',
                riskLevel: 'LOW|MEDIUM|HIGH',
                findings: [
                  {
                    code: 'string',
                    message: 'string',
                    field: 'string?',
                    evidence: 'string?',
                    confidence: 'number(0-1)?',
                    suggestion: 'PASS|NEED_FIX|NEED_MANUAL',
                  },
                ],
              },
            },
            null,
            2,
          ),
        },
        { role: 'user', content: '请把最终结果放在 <json>...</json> 中输出。' },
      ],
    });

    const parsed = this.safeParseJson<LlmContentResponse>(content);
    if (!parsed) return { status: 'PASS', findings: [] };

    const findings: ContentFinding[] = (parsed.findings ?? [])
      .slice(0, 20)
      .map((f) => ({
        code: `LLM_${String(f.code ?? 'RISK')}`.slice(0, 40),
        message: String(f.message ?? '疑似存在内容风险'),
        detail: {
          field: f.field,
          evidence: f.evidence ? String(f.evidence).slice(0, 160) : undefined,
          confidence:
            typeof f.confidence === 'number' ? f.confidence : undefined,
          suggestion: f.suggestion,
          riskLevel: parsed.riskLevel,
        },
      }));

    const status =
      parsed.status === 'FAIL' ||
      parsed.status === 'NEED_MANUAL' ||
      parsed.status === 'PASS'
        ? parsed.status
        : 'PASS';

    return { status, findings };
  }

  async extractAnonymityRisk(args: {
    chunks: Array<{ field: string; text: string }>;
  }): Promise<{
    status: 'PASS' | 'FAIL' | 'NEED_MANUAL';
    findings: AnonymityFinding[];
  }> {
    const provider = (
      this.configService.get<string>('LLM_PROVIDER') ?? 'none'
    ).toLowerCase();
    if (provider !== 'openai_compatible') {
      return { status: 'PASS', findings: [] };
    }

    const baseUrl = this.configService.get<string>('LLM_BASE_URL') ?? '';
    const apiKey = this.configService.get<string>('LLM_API_KEY') ?? '';
    const model =
      this.configService.get<string>('LLM_MODEL') ??
      (baseUrl.includes('minimaxi.com') ? 'MiniMax-M2.7' : 'gpt-4o-mini');
    const timeoutMs = Number(
      this.configService.get<string>('LLM_TIMEOUT_MS') ?? '8000',
    );
    const apiKeyHeader =
      this.configService.get<string>('LLM_API_KEY_HEADER') ?? 'Authorization';
    const apiKeyPrefix =
      this.configService.get<string>('LLM_API_KEY_PREFIX') ?? 'Bearer';
    const chatPath =
      this.configService.get<string>('LLM_CHAT_PATH') ?? '/chat/completions';

    if (
      !baseUrl ||
      !apiKey ||
      apiKey === 'changeme' ||
      baseUrl.includes('api.example.com')
    ) {
      return { status: 'PASS', findings: [] };
    }

    const content = await this.openAiCompatibleChatJson({
      baseUrl,
      apiKey,
      apiKeyHeader,
      apiKeyPrefix,
      chatPath,
      model,
      timeoutMs,
      messages: [
        {
          role: 'system',
          content:
            '你是内容合规审查助手。只输出一个 <json>...</json> 包裹的 JSON 对象，不要输出任何额外文字或思考过程。判断给定文本是否泄露作者/单位/联系方式等可用于识别身份的信息，并给出结构化 findings。',
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              task: 'anonymity_check',
              input: args.chunks.map((c) => ({
                field: c.field,
                text: c.text.slice(0, 600),
              })),
              output_schema: {
                status: 'PASS|FAIL|NEED_MANUAL',
                findings: [
                  {
                    code: 'string',
                    message: 'string',
                    field: 'string?',
                    evidence: 'string?',
                    confidence: 'number(0-1)?',
                  },
                ],
              },
            },
            null,
            2,
          ),
        },
        { role: 'user', content: '请把最终结果放在 <json>...</json> 中输出。' },
      ],
    });

    const parsed = this.safeParseJson<LlmAnonymityResponse>(content);
    if (!parsed) return { status: 'PASS', findings: [] };

    const findings: AnonymityFinding[] = (parsed.findings ?? [])
      .slice(0, 20)
      .map((f) => ({
        code: `LLM_${String(f.code ?? 'SUSPECT')}`.slice(0, 40),
        message: String(f.message ?? '疑似泄露身份信息'),
        detail: {
          field: f.field,
          evidence: f.evidence ? String(f.evidence).slice(0, 120) : undefined,
          confidence:
            typeof f.confidence === 'number' ? f.confidence : undefined,
        },
      }));

    const status =
      parsed.status === 'FAIL' ||
      parsed.status === 'NEED_MANUAL' ||
      parsed.status === 'PASS'
        ? parsed.status
        : 'PASS';

    return { status, findings };
  }

  private safeParseJson<T>(text: string): T | null {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return null;
    const tagMatch = trimmed.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
    if (tagMatch?.[1]) {
      const raw = tagMatch[1].trim();
      try {
        return JSON.parse(raw) as T;
      } catch {
        const relaxed = raw
          .replace(/\\\\/g, '\\')
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n');
        try {
          return JSON.parse(relaxed) as T;
        } catch {
          return null;
        }
      }
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1)) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private async openAiCompatibleChatJson(args: {
    baseUrl: string;
    apiKey: string;
    apiKeyHeader: string;
    apiKeyPrefix: string;
    chatPath: string;
    model: string;
    timeoutMs: number;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  }): Promise<string> {
    const baseUrl = args.baseUrl.replace(/\/+$/, '');
    const chatPath = args.chatPath.startsWith('/')
      ? args.chatPath
      : `/${args.chatPath}`;
    const url = `${baseUrl}${chatPath}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
    try {
      const headerName = String(args.apiKeyHeader || 'Authorization');
      const prefix = String(args.apiKeyPrefix || 'Bearer').trim();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (headerName.toLowerCase() === 'authorization') {
        headers[headerName] = prefix ? `${prefix} ${args.apiKey}` : args.apiKey;
      } else {
        headers[headerName] = args.apiKey;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          temperature: 0,
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        return '';
      }
      const json = this.safeParseJson<any>(text);
      const content = json?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } catch {
      return '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
