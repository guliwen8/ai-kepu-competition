import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JudgingAssignmentStatus,
  SubmissionCategory,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calcCompetitionPhase } from '../competitions/competitions.service';

function safeNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

function csvEscape(v: unknown) {
  let s = '';
  if (v == null) s = '';
  else if (typeof v === 'string') s = v;
  else if (
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    typeof v === 'bigint'
  )
    s = String(v);
  else if (v instanceof Date) s = v.toISOString();
  else s = JSON.stringify(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n'))
    return `"${s.replaceAll('"', '""')}"`;
  return s;
}

type ScoreAgg = {
  submissionId: string;
  scoreCount: number;
  avgTotal: number;
  avgS1: number;
  avgS2: number;
  avgS3: number;
  avgS4: number;
  avgS5: number;
};

@Injectable()
export class PublicationsService {
  constructor(private readonly prisma: PrismaService) {}

  private minScoreCountFromConfig(config: any) {
    const n = safeNumber(config?.publication?.minScoreCount);
    if (n == null) return 1;
    return Math.max(1, Math.floor(n));
  }

  private async getCompetitionOrCurrent(competitionId?: string) {
    if (competitionId) {
      const c = await this.prisma.competition.findUnique({
        where: { id: competitionId },
      });
      if (!c) throw new NotFoundException('赛事不存在');
      return { ...c, phase: calcCompetitionPhase(c) };
    }
    const c = await this.prisma.competition.findFirst({
      where: { isCurrent: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!c) throw new NotFoundException('当前赛事不存在');
    return { ...c, phase: calcCompetitionPhase(c) };
  }

  private assertPublicPhase(phase: string) {
    if (phase === 'PUBLIC' || phase === 'ENDED') return;
    throw new BadRequestException('未到公示时间');
  }

  private aggregateScores(rows: Array<{ submissionId: string; score: any }>) {
    const map = new Map<
      string,
      {
        count: number;
        total: number;
        s1: number;
        s2: number;
        s3: number;
        s4: number;
        s5: number;
      }
    >();
    for (const r of rows) {
      const s = r.score;
      if (!s) continue;
      const cur = map.get(r.submissionId) ?? {
        count: 0,
        total: 0,
        s1: 0,
        s2: 0,
        s3: 0,
        s4: 0,
        s5: 0,
      };
      cur.count += 1;
      cur.total += Number(s.total ?? 0);
      cur.s1 += Number(s.s1 ?? 0);
      cur.s2 += Number(s.s2 ?? 0);
      cur.s3 += Number(s.s3 ?? 0);
      cur.s4 += Number(s.s4 ?? 0);
      cur.s5 += Number(s.s5 ?? 0);
      map.set(r.submissionId, cur);
    }
    const out: ScoreAgg[] = [];
    for (const [submissionId, v] of map.entries()) {
      if (v.count <= 0) continue;
      out.push({
        submissionId,
        scoreCount: v.count,
        avgTotal: round1(v.total / v.count),
        avgS1: round1(v.s1 / v.count),
        avgS2: round1(v.s2 / v.count),
        avgS3: round1(v.s3 / v.count),
        avgS4: round1(v.s4 / v.count),
        avgS5: round1(v.s5 / v.count),
      });
    }
    return out;
  }

  private withRank(
    items: Array<{
      score: ScoreAgg;
      blindCode: string;
      title: string | null;
      category: string;
      submissionId: string;
    }>,
  ) {
    const ranked: Array<
      { rank: number } & {
        score: ScoreAgg;
        blindCode: string;
        title: string | null;
        category: string;
        submissionId: string;
      }
    > = [];

    let lastKey: string | null = null;
    let rank = 0;
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const k = [
        it.score.avgTotal,
        it.score.scoreCount,
        it.score.avgS1,
        it.score.avgS2,
        it.score.avgS3,
        it.score.avgS4,
        it.score.avgS5,
      ].join('|');
      if (k !== lastKey) rank = i + 1;
      lastKey = k;
      ranked.push({ rank, ...it });
    }
    return ranked;
  }

  async getPublicLeaderboard(args: {
    competitionId?: string;
    category?: SubmissionCategory;
    page: number;
    pageSize: number;
    requirePublicPhase?: boolean;
  }) {
    const competition = await this.getCompetitionOrCurrent(args.competitionId);
    if (args.requirePublicPhase !== false) {
      this.assertPublicPhase(competition.phase);
    }

    const page = Math.max(1, Math.floor(args.page));
    const pageSize = Math.min(100, Math.max(1, Math.floor(args.pageSize)));

    const where: any = {
      competitionId: competition.id,
      status: SubmissionStatus.PUBLICIZED,
    };
    if (args.category) where.category = args.category;

    const submissions = await this.prisma.submission.findMany({
      where,
      select: { id: true, blindCode: true, category: true, title: true },
      orderBy: { createdAt: 'asc' },
    });

    const submissionIds = submissions.map((s) => s.id);
    const minScoreCount = this.minScoreCountFromConfig(competition.config);

    const assignments = submissionIds.length
      ? await this.prisma.judgingAssignment.findMany({
          where: {
            submissionId: { in: submissionIds },
            status: JudgingAssignmentStatus.SUBMITTED,
          },
          select: { submissionId: true, score: true },
        })
      : [];

    const scores = this.aggregateScores(assignments).filter(
      (s) => s.scoreCount >= minScoreCount,
    );
    const scoreMap = new Map(scores.map((s) => [s.submissionId, s]));

    const merged = submissions
      .map((s) => {
        const score = scoreMap.get(s.id);
        if (!score) return null;
        const blindCode = s.blindCode ?? s.id;
        return {
          submissionId: s.id,
          blindCode,
          title: s.title,
          category: s.category,
          score,
        };
      })
      .filter(Boolean) as Array<{
      submissionId: string;
      blindCode: string;
      title: string | null;
      category: string;
      score: ScoreAgg;
    }>;

    merged.sort((a, b) => {
      if (b.score.avgTotal !== a.score.avgTotal)
        return b.score.avgTotal - a.score.avgTotal;
      if (b.score.scoreCount !== a.score.scoreCount)
        return b.score.scoreCount - a.score.scoreCount;
      if (b.score.avgS1 !== a.score.avgS1) return b.score.avgS1 - a.score.avgS1;
      if (b.score.avgS2 !== a.score.avgS2) return b.score.avgS2 - a.score.avgS2;
      if (b.score.avgS3 !== a.score.avgS3) return b.score.avgS3 - a.score.avgS3;
      if (b.score.avgS4 !== a.score.avgS4) return b.score.avgS4 - a.score.avgS4;
      if (b.score.avgS5 !== a.score.avgS5) return b.score.avgS5 - a.score.avgS5;
      return String(a.blindCode).localeCompare(String(b.blindCode));
    });

    const ranked = this.withRank(merged);
    const total = ranked.length;
    const pageItems = ranked.slice(
      (page - 1) * pageSize,
      (page - 1) * pageSize + pageSize,
    );

    return {
      competition: {
        id: competition.id,
        title: competition.title,
        phase: competition.phase,
      },
      category: args.category ?? null,
      minScoreCount,
      total,
      page,
      pageSize,
      items: pageItems.map((x) => ({
        rank: x.rank,
        submissionId: x.submissionId,
        blindCode: x.blindCode,
        title: x.title,
        category: x.category,
        score: {
          avgTotal: x.score.avgTotal,
          scoreCount: x.score.scoreCount,
          avgS1: x.score.avgS1,
          avgS2: x.score.avgS2,
          avgS3: x.score.avgS3,
          avgS4: x.score.avgS4,
          avgS5: x.score.avgS5,
        },
      })),
    };
  }

  async getPublicSubmissionDetail(args: { submissionId: string }) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: args.submissionId },
      include: { competition: true, attachments: true },
    });
    if (!submission) throw new NotFoundException('作品不存在');
    if (submission.status !== SubmissionStatus.PUBLICIZED)
      throw new NotFoundException('作品不存在');
    const competition = submission.competition;
    if (!competition) throw new NotFoundException('赛事不存在');
    const phase = calcCompetitionPhase(competition);
    this.assertPublicPhase(phase);

    const minScoreCount = this.minScoreCountFromConfig(
      (competition as any).config,
    );
    const assignments = await this.prisma.judgingAssignment.findMany({
      where: {
        submissionId: submission.id,
        status: JudgingAssignmentStatus.SUBMITTED,
      },
      select: { submissionId: true, score: true },
    });
    const scores = this.aggregateScores(assignments).filter(
      (s) => s.scoreCount >= minScoreCount,
    );
    const score = scores[0] ?? null;

    return {
      competition: { id: competition.id, title: competition.title, phase },
      submission: {
        id: submission.id,
        blindCode: submission.blindCode ?? submission.id,
        category: submission.category,
        title: submission.title,
        intro: submission.intro ?? null,
      },
      score: score
        ? {
            avgTotal: score.avgTotal,
            scoreCount: score.scoreCount,
            avgS1: score.avgS1,
            avgS2: score.avgS2,
            avgS3: score.avgS3,
            avgS4: score.avgS4,
            avgS5: score.avgS5,
          }
        : null,
      attachments: submission.attachments.map((a) => ({
        id: a.id,
        createdAt: a.createdAt,
        kind: a.kind,
        mimeType: a.mimeType,
        byteSize: a.byteSize,
        meta: (a as any).meta ?? null,
      })),
    };
  }

  async adminExportLeaderboardCsv(args: {
    competitionId?: string;
    category?: SubmissionCategory;
  }) {
    const data = await this.getPublicLeaderboard({
      competitionId: args.competitionId,
      category: args.category,
      page: 1,
      pageSize: 100000,
      requirePublicPhase: false,
    });
    const header = [
      'rank',
      'blindCode',
      'submissionId',
      'category',
      'title',
      'avgTotal',
      'scoreCount',
      'avgS1',
      'avgS2',
      'avgS3',
      'avgS4',
      'avgS5',
    ];
    const lines = [header.join(',')];
    for (const it of data.items) {
      lines.push(
        [
          it.rank,
          csvEscape(it.blindCode),
          csvEscape(it.submissionId),
          csvEscape(it.category),
          csvEscape(it.title ?? ''),
          it.score.avgTotal,
          it.score.scoreCount,
          it.score.avgS1,
          it.score.avgS2,
          it.score.avgS3,
          it.score.avgS4,
          it.score.avgS5,
        ].join(','),
      );
    }
    return lines.join('\n');
  }
}
