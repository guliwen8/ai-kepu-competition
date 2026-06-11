import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JudgingAssignmentStatus, Prisma, ReviewTaskStatus, ReviewTaskType, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function pad(n: number, len: number) {
  const s = String(n);
  if (s.length >= len) return s;
  return `${'0'.repeat(len - s.length)}${s}`;
}

function blindPrefix(category: string) {
  if (category === 'DRAMA') return 'DRAMA';
  if (category === 'VIDEO') return 'VIDEO';
  if (category === 'SCIFI_PAINT') return 'PAINT';
  if (category === 'CREATIVE_APP') return 'APP';
  return 'WORK';
}

@Injectable()
export class JudgingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private judgingWeights() {
    const raw = this.configService.get<string>('JUDGING_WEIGHTS') ?? '';
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s));
    if (parts.length === 5 && parts.every((n) => Number.isFinite(n) && n >= 0)) return parts;
    return [1, 1, 1, 1, 1];
  }

  async ensureBlindCode(submissionId: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, blindCode: true, category: true },
    });
    if (!sub) throw new NotFoundException('作品不存在');
    if (sub.blindCode) return sub.blindCode;

    const prefix = blindPrefix(sub.category);
    for (let attempt = 0; attempt < 3; attempt++) {
      const count = await this.prisma.submission.count({
        where: { category: sub.category, blindCode: { not: null } },
      });
      const code = `${prefix}-${pad(count + 1, 6)}`;
      try {
        const updated = await this.prisma.submission.update({
          where: { id: submissionId },
          data: { blindCode: code },
          select: { blindCode: true },
        });
        return updated.blindCode!;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('生成盲评编号失败，请重试');
  }

  private async canEnterJudging(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        reviewCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { tasks: true } },
        competition: true,
      },
    });
    if (!submission) throw new NotFoundException('作品不存在');

    if (submission.competition) {
      const now = Date.now();
      if (submission.competition.judgingStart && now < submission.competition.judgingStart.getTime()) {
        return { ok: false, reason: '评审未开始' };
      }
      if (submission.competition.judgingEnd && now > submission.competition.judgingEnd.getTime()) {
        return { ok: false, reason: '评审已结束' };
      }
    }

    const okStatus =
      submission.status === SubmissionStatus.APPROVED ||
      submission.status === SubmissionStatus.UNDER_REVIEW ||
      submission.status === SubmissionStatus.IN_JUDGING;
    if (!okStatus) return { ok: false, reason: '当前作品状态不可进入评审' };

    const latest = submission.reviewCases[0] ?? null;
    const anon = latest?.tasks.find((t) => t.type === ReviewTaskType.ANONYMITY) ?? null;
    if (anon && anon.status === ReviewTaskStatus.FAIL) return { ok: false, reason: '匿名检测未通过' };
    const format = latest?.tasks.find((t) => t.type === ReviewTaskType.FORMAT) ?? null;
    if (format && format.status === ReviewTaskStatus.FAIL) return { ok: false, reason: '格式审核未通过' };

    return { ok: true, reason: null };
  }

  async adminBatchAssign(args: {
    submissionIds: string[];
    judgeIds: string[];
    ensureBlindCode?: boolean;
  }) {
    if (args.submissionIds.length === 0 || args.judgeIds.length === 0) {
      throw new BadRequestException('参数不能为空');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { id: { in: args.submissionIds } },
      include: { members: true },
    });
    const map = new Map(submissions.map((s) => [s.id, s]));

    const creates: Array<{ submissionId: string; judgeId: string }> = [];
    const skips: Array<{ submissionId: string; judgeId: string; reason: string }> = [];

    for (const submissionId of args.submissionIds) {
      const sub = map.get(submissionId);
      if (!sub) {
        for (const judgeId of args.judgeIds) {
          skips.push({ submissionId, judgeId, reason: '作品不存在' });
        }
        continue;
      }

      const eligible = await this.canEnterJudging(submissionId);
      if (!eligible.ok) {
        for (const judgeId of args.judgeIds) {
          skips.push({ submissionId, judgeId, reason: eligible.reason ?? '不可进入评审' });
        }
        continue;
      }

      if (args.ensureBlindCode) {
        await this.ensureBlindCode(submissionId);
      }

      for (const judgeId of args.judgeIds) {
        const conflict = judgeId === sub.ownerId || sub.members.some((m) => m.userId === judgeId);
        if (conflict) {
          skips.push({ submissionId, judgeId, reason: '利益冲突：评委为作品成员' });
          continue;
        }
        creates.push({ submissionId, judgeId });
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];
      for (const c of creates) {
        const exists = await tx.judgingAssignment.findUnique({
          where: { submissionId_judgeId: { submissionId: c.submissionId, judgeId: c.judgeId } },
          select: { id: true, status: true },
        });
        if (exists) {
          if (exists.status === JudgingAssignmentStatus.REVOKED) {
            await tx.judgingScore.deleteMany({ where: { assignmentId: exists.id } });
            await tx.judgingAssignment.update({
              where: { id: exists.id },
              data: { status: JudgingAssignmentStatus.ASSIGNED, submittedAt: null, lockedAt: null },
            });
            createdIds.push(exists.id);
          }
          continue;
        }
        const row = await tx.judgingAssignment.create({ data: { submissionId: c.submissionId, judgeId: c.judgeId } });
        createdIds.push(row.id);
      }
      await tx.submission.updateMany({
        where: { id: { in: args.submissionIds }, status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.UNDER_REVIEW] } },
        data: { status: SubmissionStatus.IN_JUDGING },
      });
      return createdIds;
    });

    return {
      ok: true,
      createdCount: created.length,
      skipped: skips,
    };
  }

  async adminRevokeAssignment(args: { assignmentId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.judgingAssignment.findUnique({ where: { id: args.assignmentId }, include: { score: true } });
      if (!a) throw new NotFoundException('任务不存在');
      if (a.status === JudgingAssignmentStatus.SUBMITTED) throw new BadRequestException('已提交任务不可撤销');
      await tx.judgingScore.deleteMany({ where: { assignmentId: a.id } });
      const updated = await tx.judgingAssignment.update({
        where: { id: a.id },
        data: { status: JudgingAssignmentStatus.REVOKED, submittedAt: null, lockedAt: null },
      });
      return { ok: true, id: updated.id, status: updated.status };
    });
  }

  async adminListAssignments(args: { page: number; pageSize: number; status?: JudgingAssignmentStatus; judgeId?: string }) {
    const page = Number.isFinite(args.page) && args.page > 0 ? args.page : 1;
    const pageSize = Number.isFinite(args.pageSize) && args.pageSize > 0 ? args.pageSize : 20;
    const where: any = {};
    if (args.status) where.status = args.status;
    if (args.judgeId) where.judgeId = args.judgeId;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.judgingAssignment.count({ where }),
      this.prisma.judgingAssignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          submission: { select: { id: true, category: true, title: true, blindCode: true, status: true } },
          judge: { select: { id: true, phone: true, username: true, judgeProfile: true } },
          score: true,
        },
      }),
    ]);

    return { page, pageSize, total, items };
  }

  async adminExportCsv(args: { submittedOnly?: boolean }) {
    const where: any = {};
    if (args.submittedOnly) where.status = JudgingAssignmentStatus.SUBMITTED;

    const items = await this.prisma.judgingAssignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        submission: { select: { id: true, blindCode: true, category: true, title: true } },
        judge: { select: { id: true, phone: true, username: true } },
        score: true,
      },
    });

    const header = [
      'blindCode',
      'submissionId',
      'category',
      'title',
      'judgeId',
      'judgePhone',
      's1',
      's2',
      's3',
      's4',
      's5',
      'total',
      'comment',
      'submittedAt',
    ];

    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    };

    const lines: string[] = [header.join(',')];
    for (const it of items) {
      const row = [
        it.submission.blindCode ?? '',
        it.submissionId,
        it.submission.category,
        it.submission.title,
        it.judgeId,
        it.judge.phone ?? '',
        it.score?.s1 ?? '',
        it.score?.s2 ?? '',
        it.score?.s3 ?? '',
        it.score?.s4 ?? '',
        it.score?.s5 ?? '',
        it.score?.total ?? '',
        it.score?.comment ?? '',
        it.submittedAt ? it.submittedAt.toISOString() : '',
      ].map(escape);
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  async adminListJudges(args: { page: number; pageSize: number; q?: string }) {
    const page = Number.isFinite(args.page) && args.page > 0 ? args.page : 1;
    const pageSize = Number.isFinite(args.pageSize) && args.pageSize > 0 ? args.pageSize : 20;
    const q = args.q?.trim();

    const where: any = {
      userRoles: { some: { role: { code: 'judge' } } },
      ...(q
        ? {
            OR: [
              { phone: { contains: q } },
              { username: { contains: q } },
              { judgeProfile: { realName: { contains: q } } },
              { judgeProfile: { orgName: { contains: q } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          phone: true,
          username: true,
          judgeProfile: true,
        },
      }),
    ]);

    const ids = items.map((i) => i.id);
    const [assignedCounts, submittedCounts] = await Promise.all([
      this.prisma.judgingAssignment.groupBy({
        by: ['judgeId'],
        where: { judgeId: { in: ids }, status: { not: 'REVOKED' as any } },
        _count: { _all: true },
      }),
      this.prisma.judgingAssignment.groupBy({
        by: ['judgeId'],
        where: { judgeId: { in: ids }, status: 'SUBMITTED' as any },
        _count: { _all: true },
      }),
    ]);
    const assignedMap = new Map(assignedCounts.map((g) => [g.judgeId, g._count._all]));
    const submittedMap = new Map(submittedCounts.map((g) => [g.judgeId, g._count._all]));

    return {
      page,
      pageSize,
      total,
      items: items.map((it) => {
        const assigned = assignedMap.get(it.id) ?? 0;
        const submitted = submittedMap.get(it.id) ?? 0;
        const completionRate = assigned === 0 ? 0 : Math.round((submitted / assigned) * 100);
        return { ...it, assignedCount: assigned, submittedCount: submitted, completionRate };
      }),
    };
  }

  async grantJudgeByPhone(args: { phone: string; realName: string; orgName?: string; title?: string; contact?: string }) {
    const user = await this.prisma.user.findUnique({ where: { phone: args.phone } });
    if (!user) throw new NotFoundException('用户不存在');

    const role = await this.prisma.role.upsert({
      where: { code: 'judge' },
      update: {},
      create: { code: 'judge', name: '评委' },
    });

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    const profile = await this.prisma.judgeProfile.upsert({
      where: { userId: user.id },
      update: { realName: args.realName, orgName: args.orgName, title: args.title, contact: args.contact },
      create: { userId: user.id, realName: args.realName, orgName: args.orgName, title: args.title, contact: args.contact },
    });

    return { ok: true, userId: user.id, profile };
  }

  async judgeListAssignments(userId: string, status?: JudgingAssignmentStatus) {
    const where: any = { judgeId: userId };
    if (status) where.status = status;

    const list = await this.prisma.judgingAssignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        submission: {
          select: {
            id: true,
            blindCode: true,
            category: true,
            title: true,
            intro: true,
            aiToolsUsage: true,
            attachments: { select: { id: true, createdAt: true, kind: true, mimeType: true, byteSize: true, meta: true } },
            reviewCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { tasks: true } },
          },
        },
        score: true,
      },
    });

    return list.map((a) => ({
      id: a.id,
      status: a.status,
      submittedAt: a.submittedAt,
      lockedAt: a.lockedAt,
      submission: {
        id: a.submission.id,
        blindCode: a.submission.blindCode,
        category: a.submission.category,
        title: a.submission.title,
        intro: a.submission.intro,
        aiToolsUsage: a.submission.aiToolsUsage,
        attachments: a.submission.attachments,
        latestReview: a.submission.reviewCases[0] ?? null,
      },
      score: a.score,
    }));
  }

  async judgeGetAssignment(userId: string, id: string) {
    const a = await this.prisma.judgingAssignment.findUnique({
      where: { id },
      include: {
        submission: {
          select: {
            id: true,
            blindCode: true,
            category: true,
            title: true,
            intro: true,
            aiToolsUsage: true,
            attachments: { select: { id: true, createdAt: true, kind: true, mimeType: true, byteSize: true, meta: true } },
            reviewCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { tasks: true } },
          },
        },
        score: true,
      },
    });
    if (!a) throw new NotFoundException('任务不存在');
    if (a.judgeId !== userId) throw new ForbiddenException();
    return {
      id: a.id,
      status: a.status,
      submittedAt: a.submittedAt,
      lockedAt: a.lockedAt,
      submission: {
        id: a.submission.id,
        blindCode: a.submission.blindCode,
        category: a.submission.category,
        title: a.submission.title,
        intro: a.submission.intro,
        aiToolsUsage: a.submission.aiToolsUsage,
        attachments: a.submission.attachments,
        latestReview: a.submission.reviewCases[0] ?? null,
      },
      score: a.score,
    };
  }

  async judgeUpsertScore(userId: string, assignmentId: string, input: { s1: number; s2: number; s3: number; s4: number; s5: number; comment?: string }) {
    const a = await this.prisma.judgingAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, judgeId: true, lockedAt: true, submissionId: true },
    });
    if (!a) throw new NotFoundException('任务不存在');
    if (a.judgeId !== userId) throw new ForbiddenException();
    if (a.lockedAt) throw new ConflictException('已提交锁定，不可修改');

    const submission = await this.prisma.submission.findUnique({
      where: { id: a.submissionId },
      select: { competition: true },
    });
    if (submission?.competition) {
      const now = Date.now();
      if (submission.competition.judgingStart && now < submission.competition.judgingStart.getTime()) {
        throw new BadRequestException('评审未开始');
      }
      if (submission.competition.judgingEnd && now > submission.competition.judgingEnd.getTime()) {
        throw new BadRequestException('评审已结束');
      }
    }

    const rawTotal = input.s1 + input.s2 + input.s3 + input.s4 + input.s5;
    const weights = this.judgingWeights();
    const weightedTotal = Math.round(
      input.s1 * weights[0] + input.s2 * weights[1] + input.s3 * weights[2] + input.s4 * weights[3] + input.s5 * weights[4],
    );

    const score = await this.prisma.judgingScore.upsert({
      where: { assignmentId },
      update: {
        s1: input.s1,
        s2: input.s2,
        s3: input.s3,
        s4: input.s4,
        s5: input.s5,
        total: weightedTotal,
        comment: input.comment ?? null,
        extra: { rawTotal, weights } as any,
      },
      create: {
        assignmentId,
        s1: input.s1,
        s2: input.s2,
        s3: input.s3,
        s4: input.s4,
        s5: input.s5,
        total: weightedTotal,
        comment: input.comment ?? null,
        extra: { rawTotal, weights } as any,
      },
    });

    return score;
  }

  async judgeSubmit(userId: string, assignmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.judgingAssignment.findUnique({ where: { id: assignmentId }, include: { score: true } });
      if (!a) throw new NotFoundException('任务不存在');
      if (a.judgeId !== userId) throw new ForbiddenException();
      if (a.lockedAt) return a;
      if (!a.score) throw new BadRequestException('请先完成评分');

      const submission = await tx.submission.findUnique({
        where: { id: a.submissionId },
        select: { competition: true },
      });
      if (submission?.competition) {
        const now = Date.now();
        if (submission.competition.judgingStart && now < submission.competition.judgingStart.getTime()) {
          throw new BadRequestException('评审未开始');
        }
        if (submission.competition.judgingEnd && now > submission.competition.judgingEnd.getTime()) {
          throw new BadRequestException('评审已结束');
        }
      }

      return tx.judgingAssignment.update({
        where: { id: assignmentId },
        data: { status: JudgingAssignmentStatus.SUBMITTED, submittedAt: new Date(), lockedAt: new Date() },
        include: { score: true },
      });
    });
  }
}
