import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentKind, ReviewTaskStatus, ReviewTaskType, SubmissionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { runAnonymityRules, type AnonymityFinding } from '../reviews/anonymity-rules';
import { runContentRules } from '../reviews/content-rules';
import type { ContentFinding } from '../reviews/content-types';
import { requirementFor, type FormatFinding } from '../submissions/format-rules';
import { AdminDecision } from './dto/admin-decision.dto';

type LatestTask = { type: ReviewTaskType; status: ReviewTaskStatus; findings: any };

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

  async bootstrapAdmin(userId: string, token: string) {
    const expected = this.configService.get<string>('ADMIN_BOOTSTRAP_TOKEN') ?? '';
    if (!expected || token !== expected) throw new ForbiddenException();

    const role = await this.prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: { code: 'admin', name: '管理员' },
    });

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });

    const roles = await this.prisma.userRole.findMany({ where: { userId }, include: { role: true } });
    return { ok: true, roles: roles.map((r) => r.role.code) };
  }

  async listSubmissions(args: {
    page: number;
    pageSize: number;
    status?: SubmissionStatus;
    q?: string;
  }) {
    const page = Math.max(1, Math.floor(args.page));
    const pageSize = Math.min(50, Math.max(1, Math.floor(args.pageSize)));

    const where: any = {};
    if (args.status) where.status = args.status;
    if (args.q) {
      where.OR = [{ title: { contains: args.q, mode: 'insensitive' } }, { id: { contains: args.q } }];
    }

    const [total, rows] = await Promise.all([
      this.prisma.submission.count({ where }),
      this.prisma.submission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reviewCases: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { tasks: true },
          },
        },
      }),
    ]);

    const ids = rows.map((r) => r.id);
    const [assignedCounts, submittedCounts] = await Promise.all([
      this.prisma.judgingAssignment.groupBy({
        by: ['submissionId'],
        where: { submissionId: { in: ids }, status: { not: 'REVOKED' as any } },
        _count: { _all: true },
      }),
      this.prisma.judgingAssignment.groupBy({
        by: ['submissionId'],
        where: { submissionId: { in: ids }, status: 'SUBMITTED' as any },
        _count: { _all: true },
      }),
    ]);
    const assignedMap = new Map(assignedCounts.map((g) => [g.submissionId, g._count._all]));
    const submittedMap = new Map(submittedCounts.map((g) => [g.submissionId, g._count._all]));

    const items = rows.map((s) => {
      const latest = s.reviewCases[0] ?? null;
      return {
        id: s.id,
        title: s.title,
        category: s.category,
        status: s.status,
        createdAt: s.createdAt,
        submittedAt: s.submittedAt,
        judgingAssignedCount: assignedMap.get(s.id) ?? 0,
        judgingSubmittedCount: submittedMap.get(s.id) ?? 0,
        latestReview: latest
          ? {
              id: latest.id,
              createdAt: latest.createdAt,
              summary: latest.summary,
              tasks: latest.tasks.map((t) => ({ type: t.type, status: t.status })),
            }
          : null,
      };
    });

    return { total, page, pageSize, items };
  }

  async getSubmissionDetail(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        attachments: true,
        members: true,
        reviewCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { tasks: true } },
      },
    });
    if (!submission) throw new NotFoundException('作品不存在');
    const latest = submission.reviewCases[0] ?? null;
    return {
      ...submission,
      latestReview: latest,
    };
  }

  async publicizeSubmission(args: { id: string; enabled: boolean }) {
    const submission = await this.prisma.submission.findUnique({ where: { id: args.id } });
    if (!submission) throw new NotFoundException('作品不存在');
    const next = args.enabled ? SubmissionStatus.PUBLICIZED : SubmissionStatus.ARCHIVED;
    const updated = await this.prisma.submission.update({
      where: { id: args.id },
      data: { status: next },
    });
    return { ok: true, id: updated.id, status: updated.status };
  }

  async publicizeSubmissionsBatch(args: { ids: string[]; enabled: boolean }) {
    const ids = Array.isArray(args.ids) ? args.ids.filter((x) => typeof x === 'string' && x.trim()) : [];
    if (ids.length === 0) throw new BadRequestException('ids 不能为空');
    const next = args.enabled ? SubmissionStatus.PUBLICIZED : SubmissionStatus.ARCHIVED;
    const r = await this.prisma.submission.updateMany({
      where: { id: { in: ids } },
      data: { status: next },
    });
    return { ok: true, updated: r.count, status: next };
  }

  async manualDecision(args: { userId: string; id: string; decision: AdminDecision; note?: string }) {
    const submission = await this.prisma.submission.findUnique({ where: { id: args.id } });
    if (!submission) throw new NotFoundException('作品不存在');

    let status: SubmissionStatus = submission.status;
    let summary = 'PASS';
    let taskStatus: ReviewTaskStatus = ReviewTaskStatus.PASS;

    if (args.decision === AdminDecision.APPROVE) {
      status = SubmissionStatus.APPROVED;
      summary = 'PASS';
      taskStatus = ReviewTaskStatus.PASS;
    } else if (args.decision === AdminDecision.NEED_FIX) {
      status = SubmissionStatus.NEED_FIX;
      summary = 'FAIL';
      taskStatus = ReviewTaskStatus.FAIL;
    } else if (args.decision === AdminDecision.REJECT) {
      status = SubmissionStatus.REJECTED;
      summary = 'FAIL';
      taskStatus = ReviewTaskStatus.FAIL;
    }

    const findings = [
      {
        code: 'MANUAL',
        message: '人工复核结论',
        detail: { decision: args.decision, note: args.note ?? null },
      },
    ];

    const reviewCase = await this.prisma.reviewCase.create({
      data: {
        submissionId: args.id,
        summary,
        tasks: {
          create: [
            {
              type: ReviewTaskType.CONTENT,
              status: taskStatus,
              findings: findings as any,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    await this.prisma.submission.update({
      where: { id: args.id },
      data: {
        status,
        submittedAt: status === SubmissionStatus.APPROVED ? submission.submittedAt ?? new Date() : submission.submittedAt,
      },
    });

    return reviewCase;
  }

  private formatCheck(
    attachments: Array<{ kind: AttachmentKind; mimeType: string | null; byteSize: number; meta: any }>,
    category: any,
    competitionConfig?: any,
  ) {
    const req = requirementFor(category, competitionConfig);
    const findings: FormatFinding[] = [];

    for (const kind of req.requiredKinds) {
      const has = attachments.some((a) => a.kind === kind);
      if (!has) findings.push({ code: 'MISSING', message: `缺少必需材料：${kind}` });
    }

    for (const rule of req.rules) {
      if ('durationSecMin' in rule) {
        const vids = attachments.filter((a) => a.kind === rule.kind);
        for (const v of vids) {
          const durationSec = typeof v.meta?.durationSec === 'number' ? v.meta.durationSec : null;
          if (durationSec == null) {
            findings.push({ code: 'DURATION_MISSING', message: '缺少视频时长信息', detail: { kind: rule.kind } });
            continue;
          }
          if (durationSec < rule.durationSecMin || durationSec > rule.durationSecMax) {
            findings.push({
              code: 'DURATION_OUT_OF_RANGE',
              message: `视频时长需在 ${rule.durationSecMin}-${rule.durationSecMax} 秒`,
              detail: { durationSec },
            });
          }
        }
        continue;
      }

      const items = attachments.filter((a) => a.kind === rule.kind);
      for (const a of items) {
        if (rule.minBytes != null && a.byteSize < rule.minBytes) {
          findings.push({ code: 'TOO_SMALL', message: '文件大小不足', detail: { kind: rule.kind } });
        }
        if (rule.maxBytes != null && a.byteSize > rule.maxBytes) {
          findings.push({ code: 'TOO_LARGE', message: '文件大小超限', detail: { kind: rule.kind } });
        }
        if (rule.mimeTypes && a.mimeType && !rule.mimeTypes.includes(a.mimeType)) {
          findings.push({
            code: 'MIME_NOT_ALLOWED',
            message: '文件类型不符合要求',
            detail: { kind: rule.kind, mimeType: a.mimeType },
          });
        }
      }
    }

    const pass = findings.length === 0;
    return { pass, findings };
  }

  private tasksMapFromLatest(latest: { tasks: LatestTask[] } | null) {
    const map = new Map<ReviewTaskType, LatestTask>();
    for (const t of latest?.tasks ?? []) map.set(t.type, t);
    return map;
  }

  async rerun(args: { id: string; types: ReviewTaskType[] }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: args.id },
      include: {
        attachments: true,
        competition: true,
        reviewCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { tasks: true } },
      },
    });
    if (!submission) throw new NotFoundException('作品不存在');

    const latest = submission.reviewCases[0] ?? null;
    const latestTasks = this.tasksMapFromLatest(latest);

    const { pass: formatPass, findings: formatFindings } = this.formatCheck(
      submission.attachments,
      submission.category,
      (submission as any).competition?.config,
    );
    const tasksToCreate: Array<{ type: ReviewTaskType; status: ReviewTaskStatus; findings: any }> = [
      {
        type: ReviewTaskType.FORMAT,
        status: formatPass ? ReviewTaskStatus.PASS : ReviewTaskStatus.FAIL,
        findings: formatFindings as any,
      },
    ];

    if (!formatPass) {
      const reviewCase = await this.prisma.reviewCase.create({
        data: { submissionId: args.id, summary: 'FAIL', tasks: { create: tasksToCreate } },
        include: { tasks: true },
      });
      await this.prisma.submission.update({
        where: { id: args.id },
        data: { status: SubmissionStatus.NEED_FIX, submittedAt: undefined },
      });
      return reviewCase;
    }

    let anonTaskStatus: ReviewTaskStatus | null = null;

    const shouldRunAnon = args.types.includes(ReviewTaskType.ANONYMITY);
    if (shouldRunAnon) {
      const ruleResult = runAnonymityRules({
        fields: [
          { field: 'title', text: submission.title },
          { field: 'intro', text: (submission as any).intro },
          { field: 'aiToolsUsage', text: (submission as any).aiToolsUsage },
          { field: 'teacherName', text: (submission as any).teacherName },
          { field: 'teacherContact', text: (submission as any).teacherContact },
        ],
        attachments: submission.attachments.map((a) => ({ originalName: a.originalName, meta: (a as any).meta })),
      });

      const chunks: Array<{ field: string; text: string }> = [];
      const push = (field: string, text: unknown) => {
        const v = typeof text === 'string' ? text.trim() : '';
        if (v) chunks.push({ field, text: v });
      };
      push('title', submission.title);
      push('intro', (submission as any).intro);
      push('aiToolsUsage', (submission as any).aiToolsUsage);
      push('teacherName', (submission as any).teacherName);
      push('teacherContact', (submission as any).teacherContact);
      for (const a of submission.attachments) push('attachment.originalName', a.originalName);

      const llm = chunks.length ? await this.aiService.extractAnonymityRisk({ chunks }) : null;
      const llmFindings: AnonymityFinding[] = llm?.findings ?? [];
      const llmStatus = llm?.status ?? 'PASS';
      const combined: AnonymityFinding[] = [...ruleResult.findings, ...llmFindings];

      anonTaskStatus = ReviewTaskStatus.PASS;
      if (ruleResult.findings.length > 0) anonTaskStatus = ReviewTaskStatus.FAIL;
      else if (llmStatus === 'FAIL') anonTaskStatus = ReviewTaskStatus.FAIL;
      else if (llmStatus === 'NEED_MANUAL') anonTaskStatus = ReviewTaskStatus.NEED_MANUAL;

      tasksToCreate.push({
        type: ReviewTaskType.ANONYMITY,
        status: anonTaskStatus,
        findings: combined as any,
      });
    } else {
      const prev = latestTasks.get(ReviewTaskType.ANONYMITY);
      if (prev) tasksToCreate.push({ type: prev.type, status: prev.status, findings: prev.findings });
      anonTaskStatus = prev?.status ?? null;
    }

    if (anonTaskStatus === ReviewTaskStatus.FAIL) {
      const reviewCase = await this.prisma.reviewCase.create({
        data: { submissionId: args.id, summary: 'FAIL', tasks: { create: tasksToCreate } },
        include: { tasks: true },
      });
      await this.prisma.submission.update({
        where: { id: args.id },
        data: { status: SubmissionStatus.NEED_FIX, submittedAt: undefined },
      });
      return reviewCase;
    }

    const shouldRunContent = args.types.includes(ReviewTaskType.CONTENT);
    if (shouldRunContent) {
      const contentChunks: Array<{ field: string; text: string }> = [];
      const push = (field: string, text: unknown) => {
        const v = typeof text === 'string' ? text.trim() : '';
        if (v) contentChunks.push({ field, text: v });
      };
      push('title', submission.title);
      push('intro', (submission as any).intro);
      push('aiToolsUsage', (submission as any).aiToolsUsage);

      const rule = runContentRules({
        fields: [
          { field: 'title', text: submission.title },
          { field: 'intro', text: (submission as any).intro },
          { field: 'aiToolsUsage', text: (submission as any).aiToolsUsage },
        ],
      });

      const llm = contentChunks.length ? await this.aiService.extractContentRisk({ chunks: contentChunks }) : null;
      const llmFindings: ContentFinding[] = llm?.findings ?? [];
      const llmStatus = llm?.status ?? 'PASS';
      const combined: ContentFinding[] = [...rule.findings, ...llmFindings];

      let contentTaskStatus: ReviewTaskStatus = ReviewTaskStatus.PASS;
      if (!rule.pass) contentTaskStatus = ReviewTaskStatus.FAIL;
      else if (llmStatus === 'FAIL') contentTaskStatus = ReviewTaskStatus.FAIL;
      else if (llmStatus === 'NEED_MANUAL') contentTaskStatus = ReviewTaskStatus.NEED_MANUAL;

      tasksToCreate.push({
        type: ReviewTaskType.CONTENT,
        status: contentTaskStatus,
        findings: combined as any,
      });
    } else {
      const prev = latestTasks.get(ReviewTaskType.CONTENT);
      if (prev) tasksToCreate.push({ type: prev.type, status: prev.status, findings: prev.findings });
    }

    const summary = tasksToCreate.some((t) => t.status === ReviewTaskStatus.FAIL)
      ? 'FAIL'
      : tasksToCreate.some((t) => t.status === ReviewTaskStatus.NEED_MANUAL)
        ? 'NEED_MANUAL'
        : 'PASS';

    const reviewCase = await this.prisma.reviewCase.create({
      data: { submissionId: args.id, summary, tasks: { create: tasksToCreate } },
      include: { tasks: true },
    });

    const nextStatus =
      summary === 'FAIL' ? SubmissionStatus.NEED_FIX : summary === 'PASS' ? SubmissionStatus.UNDER_REVIEW : SubmissionStatus.UNDER_REVIEW;

    await this.prisma.submission.update({
      where: { id: args.id },
      data: { status: nextStatus, submittedAt: summary === 'FAIL' ? undefined : submission.submittedAt ?? new Date() },
    });

    return reviewCase;
  }
}
