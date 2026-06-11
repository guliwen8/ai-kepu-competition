import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentKind, ReviewTaskStatus, ReviewTaskType, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { runAnonymityRules, type AnonymityFinding } from '../reviews/anonymity-rules';
import type { ContentFinding } from '../reviews/content-types';
import { runContentRules } from '../reviews/content-rules';
import { requirementFor, type FormatFinding } from './format-rules';

type UploadInput = {
  kind: AttachmentKind;
  originalName: string;
  storedPath: string;
  mimeType?: string;
  byteSize: number;
  meta?: Record<string, unknown>;
};

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  private allowedCategoriesFromConfig(config: any): Set<string> | null {
    const raw = config?.allowedCategories;
    if (!Array.isArray(raw)) return null;
    const values = raw.filter((v) => typeof v === 'string');
    if (values.length === 0) return null;
    return new Set(values);
  }

  private assertAllowedCategory(category: unknown, competitionConfig: any) {
    const allowed = this.allowedCategoriesFromConfig(competitionConfig);
    if (!allowed) return;
    if (typeof category !== 'string' || !allowed.has(category)) {
      throw new BadRequestException('当前赛事不支持该作品类别');
    }
  }

  private requiredFieldFlagsFromConfig(config: any): {
    intro: boolean;
    aiToolsUsage: boolean;
    teacherName: boolean;
    teacherContact: boolean;
  } {
    const intro = config?.registrationFields?.intro;
    const aiToolsUsage = config?.registrationFields?.aiToolsUsage;
    const teacherName = config?.registrationFields?.teacherName;
    const teacherContact = config?.registrationFields?.teacherContact;

    const requiredIntro =
      intro &&
      typeof intro === 'object' &&
      intro.enabled !== false &&
      intro.required === true;
    const requiredAi =
      aiToolsUsage &&
      typeof aiToolsUsage === 'object' &&
      aiToolsUsage.enabled !== false &&
      aiToolsUsage.required === true;
    const requiredTeacherName =
      teacherName &&
      typeof teacherName === 'object' &&
      teacherName.enabled !== false &&
      teacherName.required === true;
    const requiredTeacherContact =
      teacherContact &&
      typeof teacherContact === 'object' &&
      teacherContact.enabled !== false &&
      teacherContact.required === true;

    return {
      intro: requiredIntro,
      aiToolsUsage: requiredAi,
      teacherName: requiredTeacherName,
      teacherContact: requiredTeacherContact,
    };
  }

  private assertRegistrationFields(
    args: { intro?: unknown; aiToolsUsage?: unknown; teacherName?: unknown; teacherContact?: unknown },
    competitionConfig: any,
    action: string,
  ) {
    const flags = this.requiredFieldFlagsFromConfig(competitionConfig);
    const introOk = typeof args.intro === 'string' && args.intro.trim().length > 0;
    const aiOk = typeof args.aiToolsUsage === 'string' && args.aiToolsUsage.trim().length > 0;
    const nameOk = typeof args.teacherName === 'string' && args.teacherName.trim().length > 0;
    const contactOk = typeof args.teacherContact === 'string' && args.teacherContact.trim().length > 0;
    if (flags.intro && !introOk) throw new BadRequestException(`请填写作品简介后再${action}`);
    if (flags.aiToolsUsage && !aiOk) throw new BadRequestException(`请填写 AI 工具使用说明后再${action}`);
    if (flags.teacherName && !nameOk) throw new BadRequestException(`请填写指导老师姓名后再${action}`);
    if (flags.teacherContact && !contactOk) throw new BadRequestException(`请填写指导老师联系方式后再${action}`);
  }

  private assertSubmissionWindow(args: { submissionStart: Date | null; submissionEnd: Date | null }, action: string) {
    const now = Date.now();
    if (args.submissionStart && now < args.submissionStart.getTime()) {
      throw new BadRequestException(`未到提交时间，无法${action}`);
    }
    if (args.submissionEnd && now > args.submissionEnd.getTime()) {
      throw new BadRequestException(`已截止提交，无法${action}`);
    }
  }

  private assertEditableWindow(args: { submissionEnd: Date | null }, action: string) {
    const now = Date.now();
    if (args.submissionEnd && now > args.submissionEnd.getTime()) {
      throw new BadRequestException(`已截止提交，无法${action}`);
    }
  }

  async createDraft(userId: string, input: { category: any; title: string; intro?: string; aiToolsUsage?: string; teacherName?: string; teacherContact?: string; teamId?: string }) {
    const count = await this.prisma.submission.count({ where: { ownerId: userId } });
    if (count >= 3) throw new BadRequestException('每位参赛者最多提交 3 件作品');

    const currentCompetition = await this.prisma.competition.findFirst({ where: { isCurrent: true } });
    if (currentCompetition) {
      this.assertEditableWindow({ submissionEnd: currentCompetition.submissionEnd }, '创建作品');
    }
    this.assertAllowedCategory(input.category, currentCompetition?.config);
    this.assertRegistrationFields(
      {
        intro: input.intro,
        aiToolsUsage: input.aiToolsUsage,
        teacherName: input.teacherName,
        teacherContact: input.teacherContact,
      },
      currentCompetition?.config,
      '创建草稿',
    );

    let membersToSnapshot: Array<{ userId: string; role?: string }> = [{ userId, role: 'owner' }];

    if (input.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: input.teamId },
        include: { members: true },
      });
      if (!team) throw new NotFoundException('团队不存在');

      const isMember = team.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException();

      if (team.members.length > 10) throw new BadRequestException('团队人数上限为 10 人');

      const memberIds = team.members.map((m) => m.userId).filter((id) => id !== team.ownerId);
      if (memberIds.length > 0) {
        const memberCounts = await this.prisma.submissionMember.groupBy({
          by: ['userId'],
          where: { userId: { in: memberIds } },
          _count: { userId: true },
        });
        const over = memberCounts.find((r) => (r._count.userId ?? 0) >= 2);
        if (over) throw new BadRequestException('团队成员参与作品数量已达上限');
      }

      membersToSnapshot = team.members.map((m) => ({ userId: m.userId, role: m.role }));
    }

    const submission = await this.prisma.submission.create({
      data: {
        competitionId: currentCompetition?.id ?? undefined,
        category: input.category,
        title: input.title,
        intro: input.intro,
        aiToolsUsage: input.aiToolsUsage,
        teacherName: input.teacherName,
        teacherContact: input.teacherContact,
        ownerId: userId,
        teamId: input.teamId,
        members: {
          create: membersToSnapshot.map((m) => ({ userId: m.userId, role: m.role ?? 'member' })),
        },
      },
      include: { attachments: true, members: true },
    });

    return submission;
  }

  async mySubmissions(userId: string) {
    return this.prisma.submission.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        attachments: true,
        reviewCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(userId: string, id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        attachments: true,
        members: true,
        reviewCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tasks: true },
        },
      },
    });
    if (!submission) throw new NotFoundException('作品不存在');
    const canRead = submission.ownerId === userId || submission.members.some((m) => m.userId === userId);
    if (!canRead) throw new ForbiddenException();
    return submission;
  }

  async updateDraft(userId: string, id: string, patch: any) {
    const submission = await this.prisma.submission.findUnique({ where: { id }, include: { competition: true } });
    if (!submission) throw new NotFoundException('作品不存在');
    if (submission.ownerId !== userId) throw new ForbiddenException();
    const editable =
      submission.status === SubmissionStatus.DRAFT || submission.status === SubmissionStatus.NEED_FIX;
    if (!editable) {
      throw new BadRequestException('当前状态不可编辑');
    }
    if (submission.competition) {
      this.assertEditableWindow({ submissionEnd: submission.competition.submissionEnd }, '编辑作品');
    }
    if ('intro' in patch || 'aiToolsUsage' in patch || 'teacherName' in patch || 'teacherContact' in patch) {
      this.assertRegistrationFields(
        {
          intro: patch.intro,
          aiToolsUsage: patch.aiToolsUsage,
          teacherName: patch.teacherName,
          teacherContact: patch.teacherContact,
        },
        (submission as any).competition?.config,
        '保存草稿',
      );
    }
    return this.prisma.submission.update({
      where: { id },
      data: {
        title: patch.title ?? undefined,
        intro: patch.intro ?? undefined,
        aiToolsUsage: patch.aiToolsUsage ?? undefined,
        teacherName: patch.teacherName ?? undefined,
        teacherContact: patch.teacherContact ?? undefined,
      },
      include: { attachments: true, members: true },
    });
  }

  async addAttachment(userId: string, submissionId: string, input: UploadInput) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { members: true, competition: true },
    });
    if (!submission) throw new NotFoundException('作品不存在');
    const isMember = submission.members.some((m) => m.userId === userId) || submission.ownerId === userId;
    if (!isMember) throw new ForbiddenException();
    const canUpload =
      submission.status === SubmissionStatus.DRAFT || submission.status === SubmissionStatus.NEED_FIX;
    if (!canUpload) {
      throw new BadRequestException('当前状态不可上传附件');
    }
    if (submission.competition) {
      this.assertEditableWindow({ submissionEnd: submission.competition.submissionEnd }, '上传附件');
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        kind: input.kind,
        originalName: input.originalName,
        storedPath: input.storedPath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        meta: (input.meta ?? undefined) as any,
        submissionId,
        uploaderId: userId,
      },
    });
    return attachment;
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
      if (!has) {
        findings.push({ code: 'MISSING', message: `缺少必需材料：${kind}` });
      }
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

  async submit(userId: string, id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { attachments: true, competition: true },
    });
    if (!submission) throw new NotFoundException('作品不存在');
    if (submission.ownerId !== userId) throw new ForbiddenException();
    const canSubmit =
      submission.status === SubmissionStatus.DRAFT || submission.status === SubmissionStatus.NEED_FIX;
    if (!canSubmit) {
      throw new BadRequestException('当前状态不可提交');
    }
    if (submission.competition) {
      this.assertSubmissionWindow(
        { submissionStart: submission.competition.submissionStart, submissionEnd: submission.competition.submissionEnd },
        '提交作品',
      );
    }
    this.assertAllowedCategory(submission.category, (submission as any).competition?.config);
    this.assertRegistrationFields(
      {
        intro: (submission as any).intro,
        aiToolsUsage: (submission as any).aiToolsUsage,
        teacherName: (submission as any).teacherName,
        teacherContact: (submission as any).teacherContact,
      },
      (submission as any).competition?.config,
      '提交',
    );

    const { pass, findings } = this.formatCheck(submission.attachments, submission.category, (submission as any).competition?.config);

    const tasksToCreate: Array<{
      type: ReviewTaskType;
      status: ReviewTaskStatus;
      findings: any;
    }> = [
      {
        type: ReviewTaskType.FORMAT,
        status: pass ? ReviewTaskStatus.PASS : ReviewTaskStatus.FAIL,
        findings: findings as any,
      },
    ];

    let summary: string = pass ? 'PASS' : 'FAIL';
    let nextStatus: SubmissionStatus = pass ? SubmissionStatus.UNDER_REVIEW : SubmissionStatus.NEED_FIX;
    let submittedAt: Date | undefined = pass ? new Date() : undefined;

    if (pass) {
      const ruleResult = runAnonymityRules({
        fields: [
          { field: 'title', text: submission.title },
          { field: 'intro', text: (submission as any).intro },
          { field: 'aiToolsUsage', text: (submission as any).aiToolsUsage },
          { field: 'teacherName', text: (submission as any).teacherName },
          { field: 'teacherContact', text: (submission as any).teacherContact },
        ],
        attachments: submission.attachments.map((a) => ({
          originalName: a.originalName,
          meta: (a as any).meta,
        })),
      });

      const chunks: Array<{ field: string; text: string }> = [];
      const pushChunk = (field: string, text: unknown) => {
        const v = typeof text === 'string' ? text.trim() : '';
        if (v) chunks.push({ field, text: v });
      };

      pushChunk('title', submission.title);
      pushChunk('intro', (submission as any).intro);
      pushChunk('aiToolsUsage', (submission as any).aiToolsUsage);
      pushChunk('teacherName', (submission as any).teacherName);
      pushChunk('teacherContact', (submission as any).teacherContact);
      for (const a of submission.attachments) {
        pushChunk('attachment.originalName', a.originalName);
      }

      const llm = chunks.length > 0 ? await this.aiService.extractAnonymityRisk({ chunks }) : null;

      const llmFindings: AnonymityFinding[] = llm?.findings ?? [];
      const llmStatus = llm?.status ?? 'PASS';

      const combinedFindings: AnonymityFinding[] = [...ruleResult.findings, ...llmFindings];

      let anonTaskStatus: ReviewTaskStatus = ReviewTaskStatus.PASS;
      if (ruleResult.findings.length > 0) anonTaskStatus = ReviewTaskStatus.FAIL;
      else if (llmStatus === 'FAIL') anonTaskStatus = ReviewTaskStatus.FAIL;
      else if (llmStatus === 'NEED_MANUAL') anonTaskStatus = ReviewTaskStatus.NEED_MANUAL;

      tasksToCreate.push({
        type: ReviewTaskType.ANONYMITY,
        status: anonTaskStatus,
        findings: combinedFindings as any,
      });

      if (anonTaskStatus === ReviewTaskStatus.FAIL) {
        summary = 'FAIL';
        nextStatus = SubmissionStatus.NEED_FIX;
        submittedAt = undefined;
      } else if (anonTaskStatus === ReviewTaskStatus.NEED_MANUAL) {
        summary = 'NEED_MANUAL';
        nextStatus = SubmissionStatus.UNDER_REVIEW;
        submittedAt = new Date();
      } else {
        summary = 'PASS';
        nextStatus = SubmissionStatus.UNDER_REVIEW;
        submittedAt = new Date();
      }

      if (anonTaskStatus !== ReviewTaskStatus.FAIL) {
        const contentChunks: Array<{ field: string; text: string }> = [];
        const push = (field: string, text: unknown) => {
          const v = typeof text === 'string' ? text.trim() : '';
          if (v) contentChunks.push({ field, text: v });
        };

        push('title', submission.title);
        push('intro', (submission as any).intro);
        push('aiToolsUsage', (submission as any).aiToolsUsage);

        const contentRule = runContentRules({
          fields: [
            { field: 'title', text: submission.title },
            { field: 'intro', text: (submission as any).intro },
            { field: 'aiToolsUsage', text: (submission as any).aiToolsUsage },
          ],
        });

        const contentLlm =
          contentChunks.length > 0 ? await this.aiService.extractContentRisk({ chunks: contentChunks }) : null;
        const contentFindings: ContentFinding[] = [...contentRule.findings, ...(contentLlm?.findings ?? [])];
        const contentStatus = contentLlm?.status ?? 'PASS';

        let contentTaskStatus: ReviewTaskStatus = ReviewTaskStatus.PASS;
        if (!contentRule.pass) contentTaskStatus = ReviewTaskStatus.FAIL;
        else if (contentStatus === 'FAIL') contentTaskStatus = ReviewTaskStatus.FAIL;
        else if (contentStatus === 'NEED_MANUAL') contentTaskStatus = ReviewTaskStatus.NEED_MANUAL;

        tasksToCreate.push({
          type: ReviewTaskType.CONTENT,
          status: contentTaskStatus,
          findings: contentFindings as any,
        });

        if (contentTaskStatus === ReviewTaskStatus.FAIL) {
          summary = 'FAIL';
          nextStatus = SubmissionStatus.NEED_FIX;
          submittedAt = undefined;
        } else if (
          anonTaskStatus === ReviewTaskStatus.NEED_MANUAL ||
          contentTaskStatus === ReviewTaskStatus.NEED_MANUAL
        ) {
          summary = 'NEED_MANUAL';
          nextStatus = SubmissionStatus.UNDER_REVIEW;
          submittedAt = new Date();
        } else {
          summary = 'PASS';
          nextStatus = SubmissionStatus.UNDER_REVIEW;
          submittedAt = new Date();
        }
      }
    }

    const reviewCase = await this.prisma.reviewCase.create({
      data: {
        submissionId: id,
        summary,
        tasks: {
          create: tasksToCreate,
        },
      },
      include: { tasks: true },
    });

    await this.prisma.submission.update({
      where: { id },
      data: {
        status: nextStatus,
        submittedAt,
      },
    });

    return reviewCase;
  }
}
