import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { AdminAssignBatchDto } from './dto/admin-assign-batch.dto';
import { AdminGrantJudgeDto } from './dto/admin-grant-judge.dto';
import { JudgingService } from './judging.service';
import { JudgingAssignmentStatus } from '@prisma/client';

@ApiTags('admin-judging')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/judging')
export class JudgingAdminController {
  constructor(
    private readonly judgingService: JudgingService,
    private readonly auditService: AuditService,
  ) {}

  @Get('judges')
  listJudges(@Query('page') page = '1', @Query('pageSize') pageSize = '20', @Query('q') q?: string) {
    return this.judgingService.adminListJudges({ page: Number(page), pageSize: Number(pageSize), q });
  }

  @Post('judges/grant')
  async grantJudge(@Req() req: any, @Body() dto: AdminGrantJudgeDto) {
    const r = await this.judgingService.grantJudgeByPhone(dto);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_JUDGE_GRANT',
      resourceType: 'Judge',
      resourceId: (r as any).userId ?? null,
      after: { userId: (r as any).userId ?? null },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post('assignments:batch')
  async assignBatch(@Req() req: any, @Body() dto: AdminAssignBatchDto) {
    const r = await this.judgingService.adminBatchAssign({
      submissionIds: dto.submissionIds,
      judgeIds: dto.judgeIds,
      ensureBlindCode: dto.ensureBlindCode,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_JUDGING_ASSIGN_BATCH',
      resourceType: 'JudgingAssignment',
      after: { ...r, submissionIds: dto.submissionIds, judgeIds: dto.judgeIds, ensureBlindCode: dto.ensureBlindCode },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Get('assignments')
  listAssignments(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: JudgingAssignmentStatus,
    @Query('judgeId') judgeId?: string,
  ) {
    return this.judgingService.adminListAssignments({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      judgeId,
    });
  }

  @Post('assignments/:id/revoke')
  async revoke(@Req() req: any, @Param('id') id: string) {
    const r = await this.judgingService.adminRevokeAssignment({ assignmentId: id });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_JUDGING_REVOKE',
      resourceType: 'JudgingAssignment',
      resourceId: id,
      after: r,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Get('export')
  async export(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('submittedOnly') submittedOnly = '1',
  ) {
    const csv = await this.judgingService.adminExportCsv({
      submittedOnly: submittedOnly === '1' || submittedOnly === 'true',
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="judging_export.csv"`);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_JUDGING_EXPORT',
      resourceType: 'JudgingExport',
      after: { submittedOnly: submittedOnly === '1' || submittedOnly === 'true' },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return csv;
  }
}
