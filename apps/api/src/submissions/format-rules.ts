import { AttachmentKind, SubmissionCategory } from '@prisma/client';

export type FormatFinding = {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
};

export type CategoryRequirement = {
  requiredKinds: AttachmentKind[];
  rules: Array<
    | {
        kind: AttachmentKind;
        maxBytes?: number;
        minBytes?: number;
        mimeTypes?: string[];
      }
    | {
        kind: AttachmentKind;
        durationSecMin: number;
        durationSecMax: number;
      }
  >;
};

const MB = 1024 * 1024;

function normalizeRequirement(raw: any): CategoryRequirement | null {
  if (!raw || typeof raw !== 'object') return null;
  const requiredKinds = Array.isArray(raw.requiredKinds) ? raw.requiredKinds.filter((k) => typeof k === 'string') : null;
  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : null;
  if (!requiredKinds || !rulesRaw) return null;

  const rules: any[] = [];
  for (const r of rulesRaw) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.kind !== 'string') continue;
    if (typeof r.durationSecMin === 'number' && typeof r.durationSecMax === 'number') {
      rules.push({ kind: r.kind, durationSecMin: r.durationSecMin, durationSecMax: r.durationSecMax });
      continue;
    }
    const rule: any = { kind: r.kind };
    if (typeof r.maxBytes === 'number') rule.maxBytes = r.maxBytes;
    if (typeof r.minBytes === 'number') rule.minBytes = r.minBytes;
    if (Array.isArray(r.mimeTypes)) rule.mimeTypes = r.mimeTypes.filter((m: any) => typeof m === 'string');
    rules.push(rule);
  }

  return { requiredKinds: requiredKinds as any, rules: rules as any };
}

export function requirementFor(category: SubmissionCategory, competitionConfig?: any): CategoryRequirement {
  const override = competitionConfig?.materialRequirements?.[category];
  const normalized = normalizeRequirement(override);
  if (normalized) return normalized;
  switch (category) {
    case SubmissionCategory.DRAMA:
      return {
        requiredKinds: [AttachmentKind.VIDEO, AttachmentKind.SCRIPT],
        rules: [
          {
            kind: AttachmentKind.VIDEO,
            maxBytes: 500 * MB,
            mimeTypes: ['video/mp4'],
          },
          {
            kind: AttachmentKind.SCRIPT,
            maxBytes: 50 * MB,
            mimeTypes: [
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
          },
        ],
      };
    case SubmissionCategory.VIDEO:
      return {
        requiredKinds: [AttachmentKind.VIDEO],
        rules: [
          {
            kind: AttachmentKind.VIDEO,
            maxBytes: 500 * MB,
            mimeTypes: ['video/mp4'],
          },
          {
            kind: AttachmentKind.VIDEO,
            durationSecMin: 60,
            durationSecMax: 300,
          },
        ],
      };
    case SubmissionCategory.SCIFI_PAINT:
      return {
        requiredKinds: [AttachmentKind.IMAGE, AttachmentKind.STATEMENT],
        rules: [
          {
            kind: AttachmentKind.IMAGE,
            minBytes: 4 * MB,
            maxBytes: 30 * MB,
            mimeTypes: ['image/jpeg', 'image/png'],
          },
          {
            kind: AttachmentKind.STATEMENT,
            maxBytes: 50 * MB,
            mimeTypes: [
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/pdf',
            ],
          },
        ],
      };
    case SubmissionCategory.CREATIVE_APP:
      return {
        requiredKinds: [AttachmentKind.VIDEO, AttachmentKind.DOC],
        rules: [
          {
            kind: AttachmentKind.VIDEO,
            maxBytes: 500 * MB,
            mimeTypes: ['video/mp4'],
          },
          {
            kind: AttachmentKind.DOC,
            maxBytes: 200 * MB,
            mimeTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/zip',
              'application/x-zip-compressed',
            ],
          },
        ],
      };
  }
}
