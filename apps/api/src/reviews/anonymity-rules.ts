export type AnonymityFinding = {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
};

export type AnonymityCheckInput = {
  fields: Array<{ field: string; text?: string | null }>;
  attachments?: Array<{ originalName: string; meta?: unknown }>;
};

const phoneRe = /1[3-9]\d{9}/g;
const idCardRe = /\d{17}[\dXx]/g;
const orgKeywordRe = /(大学|学院|中学|小学|研究所|公司|集团|医院)/g;
const nameContextRe =
  /(作者|指导老师|联系人|老师|指导|队长|成员)[:：\s]*([\u4e00-\u9fa5]{2,4})/g;

export function runAnonymityRules(input: AnonymityCheckInput): {
  pass: boolean;
  findings: AnonymityFinding[];
} {
  const findings: AnonymityFinding[] = [];

  const pushMatches = (
    field: string,
    text: string,
    re: RegExp,
    code: string,
    message: string,
  ) => {
    for (const m of text.matchAll(re)) {
      const evidence = m[0];
      findings.push({
        code,
        message,
        detail: { field, evidence, index: m.index ?? undefined },
      });
    }
  };

  for (const f of input.fields) {
    const text = (f.text ?? '').trim();
    if (!text) continue;

    pushMatches(f.field, text, phoneRe, 'PHONE', '疑似包含手机号信息');
    pushMatches(f.field, text, idCardRe, 'ID_CARD', '疑似包含身份证号信息');

    for (const m of text.matchAll(orgKeywordRe)) {
      findings.push({
        code: 'ORG_KEYWORD',
        message: '疑似包含单位/学校信息',
        detail: { field: f.field, evidence: m[0], index: m.index ?? undefined },
      });
    }

    for (const m of text.matchAll(nameContextRe)) {
      findings.push({
        code: 'NAME_CONTEXT',
        message: '疑似包含姓名信息',
        detail: { field: f.field, evidence: m[2], index: m.index ?? undefined },
      });
    }
  }

  if (input.attachments) {
    for (const a of input.attachments) {
      const name = (a.originalName ?? '').trim();
      if (!name) continue;
      pushMatches('attachment.originalName', name, phoneRe, 'PHONE', '附件名疑似包含手机号信息');
      pushMatches(
        'attachment.originalName',
        name,
        idCardRe,
        'ID_CARD',
        '附件名疑似包含身份证号信息',
      );
      for (const m of name.matchAll(orgKeywordRe)) {
        findings.push({
          code: 'ORG_KEYWORD',
          message: '附件名疑似包含单位/学校信息',
          detail: { field: 'attachment.originalName', evidence: m[0], index: m.index ?? undefined },
        });
      }
    }
  }

  return { pass: findings.length === 0, findings };
}

