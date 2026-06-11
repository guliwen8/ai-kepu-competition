import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function parseDate(v?: string | null) {
  if (v == null) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const submissionCategories = new Set(['DRAMA', 'VIDEO', 'SCIFI_PAINT', 'CREATIVE_APP']);
const attachmentKinds = new Set(['VIDEO', 'IMAGE', 'SCRIPT', 'STATEMENT', 'ZIP', 'DOC', 'OTHER']);

function validateCompetitionConfig(config: unknown) {
  if (config == null) return;
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new BadRequestException('配置不合法：config 必须是 JSON 对象或 null');
  }

  const cfg: any = config;

  if (cfg.allowedCategories != null) {
    if (!Array.isArray(cfg.allowedCategories)) throw new BadRequestException('配置不合法：allowedCategories 必须是数组');
    for (const c of cfg.allowedCategories) {
      if (typeof c !== 'string' || !submissionCategories.has(c)) {
        throw new BadRequestException('配置不合法：allowedCategories 包含未知类别');
      }
    }
  }

  if (cfg.categoryOptions != null) {
    if (!Array.isArray(cfg.categoryOptions)) throw new BadRequestException('配置不合法：categoryOptions 必须是数组');
    for (const it of cfg.categoryOptions) {
      if (!it || typeof it !== 'object' || Array.isArray(it)) throw new BadRequestException('配置不合法：categoryOptions 元素必须是对象');
      if (typeof (it as any).label !== 'string' || !(it as any).label.trim()) {
        throw new BadRequestException('配置不合法：categoryOptions.label 必须是非空字符串');
      }
      if (typeof (it as any).value !== 'string' || !submissionCategories.has((it as any).value)) {
        throw new BadRequestException('配置不合法：categoryOptions.value 必须是合法 SubmissionCategory');
      }
    }
  }

  if (cfg.registrationFields != null) {
    if (!cfg.registrationFields || typeof cfg.registrationFields !== 'object' || Array.isArray(cfg.registrationFields)) {
      throw new BadRequestException('配置不合法：registrationFields 必须是对象');
    }
    const allowedKeys = new Set(['title', 'intro', 'aiToolsUsage', 'teacherName', 'teacherContact']);
    for (const [k, v] of Object.entries(cfg.registrationFields)) {
      if (!allowedKeys.has(k)) throw new BadRequestException('配置不合法：registrationFields 包含未知字段');
      if (v === false) continue;
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequestException('配置不合法：registrationFields 字段配置必须是对象或 false');
      if ('enabled' in (v as any) && typeof (v as any).enabled !== 'boolean') {
        throw new BadRequestException('配置不合法：registrationFields.enabled 必须是 boolean');
      }
      if ('required' in (v as any) && typeof (v as any).required !== 'boolean') {
        throw new BadRequestException('配置不合法：registrationFields.required 必须是 boolean');
      }
      if ('label' in (v as any) && typeof (v as any).label !== 'string') {
        throw new BadRequestException('配置不合法：registrationFields.label 必须是 string');
      }
      if ('placeholder' in (v as any) && typeof (v as any).placeholder !== 'string') {
        throw new BadRequestException('配置不合法：registrationFields.placeholder 必须是 string');
      }
      if ('hint' in (v as any) && typeof (v as any).hint !== 'string') {
        throw new BadRequestException('配置不合法：registrationFields.hint 必须是 string');
      }
      if ('maxLength' in (v as any) && typeof (v as any).maxLength !== 'number') {
        throw new BadRequestException('配置不合法：registrationFields.maxLength 必须是 number');
      }
    }
  }

  if (cfg.materialRequirements != null) {
    if (!cfg.materialRequirements || typeof cfg.materialRequirements !== 'object' || Array.isArray(cfg.materialRequirements)) {
      throw new BadRequestException('配置不合法：materialRequirements 必须是对象');
    }
    for (const [cat, req] of Object.entries(cfg.materialRequirements)) {
      if (!submissionCategories.has(cat)) throw new BadRequestException('配置不合法：materialRequirements 包含未知类别');
      if (!req || typeof req !== 'object' || Array.isArray(req)) throw new BadRequestException('配置不合法：materialRequirements[category] 必须是对象');
      const requiredKinds = (req as any).requiredKinds;
      const rules = (req as any).rules;
      if (!Array.isArray(requiredKinds)) throw new BadRequestException('配置不合法：requiredKinds 必须是数组');
      if (!Array.isArray(rules)) throw new BadRequestException('配置不合法：rules 必须是数组');
      for (const k of requiredKinds) {
        if (typeof k !== 'string' || !attachmentKinds.has(k)) throw new BadRequestException('配置不合法：requiredKinds 包含未知 kind');
      }
      for (const r of rules) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) throw new BadRequestException('配置不合法：rules 元素必须是对象');
        if (typeof (r as any).kind !== 'string' || !attachmentKinds.has((r as any).kind)) {
          throw new BadRequestException('配置不合法：rules.kind 必须是合法 AttachmentKind');
        }
        if ('durationSecMin' in (r as any) || 'durationSecMax' in (r as any)) {
          if (typeof (r as any).durationSecMin !== 'number' || typeof (r as any).durationSecMax !== 'number') {
            throw new BadRequestException('配置不合法：durationSecMin/durationSecMax 必须是 number');
          }
        }
        if ('maxBytes' in (r as any) && typeof (r as any).maxBytes !== 'number') {
          throw new BadRequestException('配置不合法：maxBytes 必须是 number');
        }
        if ('minBytes' in (r as any) && typeof (r as any).minBytes !== 'number') {
          throw new BadRequestException('配置不合法：minBytes 必须是 number');
        }
        if ('mimeTypes' in (r as any)) {
          if (!Array.isArray((r as any).mimeTypes) || (r as any).mimeTypes.some((m: any) => typeof m !== 'string')) {
            throw new BadRequestException('配置不合法：mimeTypes 必须是 string[]');
          }
        }
      }
    }
  }

  if (cfg.privacyConfirmation != null) {
    if (!cfg.privacyConfirmation || typeof cfg.privacyConfirmation !== 'object' || Array.isArray(cfg.privacyConfirmation)) {
      throw new BadRequestException('配置不合法：privacyConfirmation 必须是对象');
    }
    if ('enabled' in cfg.privacyConfirmation && typeof cfg.privacyConfirmation.enabled !== 'boolean') {
      throw new BadRequestException('配置不合法：privacyConfirmation.enabled 必须是 boolean');
    }
    if ('text' in cfg.privacyConfirmation && typeof cfg.privacyConfirmation.text !== 'string') {
      throw new BadRequestException('配置不合法：privacyConfirmation.text 必须是 string');
    }
  }
}

export type CompetitionPhase = 'DRAFT' | 'SUBMISSION' | 'JUDGING' | 'PUBLIC' | 'ENDED';

export function calcCompetitionPhase(c: {
  submissionStart: Date | null;
  submissionEnd: Date | null;
  judgingStart: Date | null;
  judgingEnd: Date | null;
  publicStart: Date | null;
  publicEnd: Date | null;
}) {
  const now = Date.now();
  const inRange = (start: Date | null, end: Date | null) => {
    if (start && now < start.getTime()) return false;
    if (end && now > end.getTime()) return false;
    return Boolean(start || end);
  };

  if (inRange(c.publicStart, c.publicEnd)) return 'PUBLIC' as const;
  if (inRange(c.judgingStart, c.judgingEnd)) return 'JUDGING' as const;
  if (inRange(c.submissionStart, c.submissionEnd)) return 'SUBMISSION' as const;

  const latestEnd = [c.publicEnd, c.judgingEnd, c.submissionEnd].filter(Boolean).map((d) => (d as Date).getTime());
  if (latestEnd.length > 0 && now > Math.max(...latestEnd)) return 'ENDED' as const;
  return 'DRAFT' as const;
}

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.competition.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((c) => ({ ...c, phase: calcCompetitionPhase(c as any) }));
  }

  async getById(id: string) {
    const c = await this.prisma.competition.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('赛事不存在');
    return { ...c, phase: calcCompetitionPhase(c as any) };
  }

  async create(input: {
    title: string;
    theme?: string;
    submissionStart?: string;
    submissionEnd?: string;
    judgingStart?: string;
    judgingEnd?: string;
    publicStart?: string;
    publicEnd?: string;
    config?: Record<string, unknown>;
  }) {
    const submissionStart = parseDate(input.submissionStart) as Date | undefined;
    const submissionEnd = parseDate(input.submissionEnd) as Date | undefined;
    const judgingStart = parseDate(input.judgingStart) as Date | undefined;
    const judgingEnd = parseDate(input.judgingEnd) as Date | undefined;
    const publicStart = parseDate(input.publicStart) as Date | undefined;
    const publicEnd = parseDate(input.publicEnd) as Date | undefined;

    if (submissionStart && submissionEnd && submissionStart > submissionEnd) throw new BadRequestException('提交开始时间不能晚于结束时间');
    if (judgingStart && judgingEnd && judgingStart > judgingEnd) throw new BadRequestException('评审开始时间不能晚于结束时间');
    if (publicStart && publicEnd && publicStart > publicEnd) throw new BadRequestException('公示开始时间不能晚于结束时间');
    validateCompetitionConfig(input.config);

    const created = await this.prisma.competition.create({
      data: {
        title: input.title,
        theme: input.theme ?? null,
        submissionStart: submissionStart ?? null,
        submissionEnd: submissionEnd ?? null,
        judgingStart: judgingStart ?? null,
        judgingEnd: judgingEnd ?? null,
        publicStart: publicStart ?? null,
        publicEnd: publicEnd ?? null,
        config: (input.config ?? undefined) as any,
      },
    });

    const hasCurrent = await this.prisma.competition.count({ where: { isCurrent: true } });
    if (hasCurrent === 0) {
      await this.prisma.competition.update({ where: { id: created.id }, data: { isCurrent: true } });
      const c = await this.prisma.competition.findUnique({ where: { id: created.id } });
      return { ...c!, phase: calcCompetitionPhase(c as any) };
    }

    return { ...created, phase: calcCompetitionPhase(created as any) };
  }

  async update(id: string, input: any) {
    const existing = await this.prisma.competition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('赛事不存在');

    const patch: any = {};
    if (input.title != null) patch.title = input.title;
    if (input.theme != null) patch.theme = input.theme;

    const fields = ['submissionStart', 'submissionEnd', 'judgingStart', 'judgingEnd', 'publicStart', 'publicEnd'] as const;
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(input, f)) {
        const v = input[f];
        if (v === null) patch[f] = null;
        else patch[f] = parseDate(v);
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'config')) {
      const v = input.config;
      patch.config = v === null ? null : ((v ?? undefined) as any);
    }

    const merged = { ...existing, ...patch };
    if (merged.submissionStart && merged.submissionEnd && merged.submissionStart > merged.submissionEnd) {
      throw new BadRequestException('提交开始时间不能晚于结束时间');
    }
    if (merged.judgingStart && merged.judgingEnd && merged.judgingStart > merged.judgingEnd) {
      throw new BadRequestException('评审开始时间不能晚于结束时间');
    }
    if (merged.publicStart && merged.publicEnd && merged.publicStart > merged.publicEnd) {
      throw new BadRequestException('公示开始时间不能晚于结束时间');
    }
    validateCompetitionConfig(merged.config);

    const updated = await this.prisma.competition.update({ where: { id }, data: patch });
    return { ...updated, phase: calcCompetitionPhase(updated as any) };
  }

  async setCurrent(id: string) {
    const existing = await this.prisma.competition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('赛事不存在');

    await this.prisma.$transaction([
      this.prisma.competition.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
      this.prisma.competition.update({ where: { id }, data: { isCurrent: true } }),
    ]);

    const c = await this.prisma.competition.findUnique({ where: { id } });
    return { ...c!, phase: calcCompetitionPhase(c as any) };
  }

  async getCurrent() {
    const c = await this.prisma.competition.findFirst({ where: { isCurrent: true }, orderBy: { updatedAt: 'desc' } });
    return c ? { ...c, phase: calcCompetitionPhase(c as any) } : null;
  }
}
