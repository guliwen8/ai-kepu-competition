import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { JudgingService } from './judging.service';
import { JudgeScoreDto } from './dto/judge-score.dto';
import { JudgingAssignmentStatus } from '@prisma/client';

@ApiTags('judge-judging')
@ApiBearerAuth()
@Roles('judge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('judge/judging')
export class JudgingJudgeController {
  constructor(
    private readonly judgingService: JudgingService,
    private readonly auditService: AuditService,
  ) {}

  @Get('assignments')
  list(@Req() req: { user: { userId: string } }, @Query('status') status?: JudgingAssignmentStatus) {
    return this.judgingService.judgeListAssignments(req.user.userId, status);
  }

  @Get('assignments/:id')
  detail(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.judgingService.judgeGetAssignment(req.user.userId, id);
  }

  @Put('assignments/:id/score')
  async upsertScore(@Req() req: any, @Param('id') id: string, @Body() dto: JudgeScoreDto) {
    const r = await this.judgingService.judgeUpsertScore(req.user.userId, id, dto);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'JUDGE_ASSIGNMENT_SCORE',
      resourceType: 'JudgingAssignment',
      resourceId: id,
      after: { assignmentId: id, total: (r as any).total, s1: dto.s1, s2: dto.s2, s3: dto.s3, s4: dto.s4, s5: dto.s5 },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post('assignments/:id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    const r = await this.judgingService.judgeSubmit(req.user.userId, id);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'JUDGE_ASSIGNMENT_SUBMIT',
      resourceType: 'JudgingAssignment',
      resourceId: id,
      after: { assignmentId: id, status: (r as any).status, submittedAt: (r as any).submittedAt ?? null },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }
}
