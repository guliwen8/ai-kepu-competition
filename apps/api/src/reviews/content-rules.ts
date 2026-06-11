import type { ContentFinding } from './content-types';

export type ContentCheckInput = {
  fields: Array<{ field: string; text?: string | null }>;
};

const bannedKeywordRe =
  /(炸弹|爆炸物|枪支|制枪|毒品|制毒|赌博|色情|色情网|裸聊|恐怖袭击|自杀|自残|仇恨|歧视)/g;

export function runContentRules(input: ContentCheckInput): {
  pass: boolean;
  findings: ContentFinding[];
} {
  const findings: ContentFinding[] = [];

  for (const f of input.fields) {
    const text = (f.text ?? '').trim();
    if (!text) continue;
    for (const m of text.matchAll(bannedKeywordRe)) {
      findings.push({
        code: 'KEYWORD',
        message: '疑似包含不当内容关键词',
        detail: { field: f.field, evidence: m[0], index: m.index ?? undefined },
      });
    }
  }

  return { pass: findings.length === 0, findings };
}

