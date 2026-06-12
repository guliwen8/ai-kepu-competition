import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { AdminBootstrapDto } from './dto/admin-bootstrap.dto';
import { AdminDecisionDto } from './dto/admin-decision.dto';
import { AdminRerunDto } from './dto/admin-rerun.dto';
import { AdminPublicizeDto } from './dto/admin-publicize.dto';
import { SubmissionStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('ping')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  ping() {
    return { ok: true };
  }

  @Post('bootstrap')
  @UseGuards(JwtAuthGuard)
  async bootstrap(
    @Req() req: { user: { userId: string } },
    @Body() dto: AdminBootstrapDto,
  ) {
    return this.adminService.bootstrapAdmin(req.user.userId, dto.token);
  }

  @Get('submissions')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: SubmissionStatus,
    @Query('q') q?: string,
  ) {
    return this.adminService.listSubmissions({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      q,
    });
  }

  @Get('submissions/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async detail(@Param('id') id: string) {
    return this.adminService.getSubmissionDetail(id);
  }

  @Post('submissions/:id/decision')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async decision(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: AdminDecisionDto,
  ) {
    const r = await this.adminService.manualDecision({
      userId: req.user.userId,
      id,
      decision: dto.decision,
      note: dto.note,
    });
    await this.auditService.write({
      actorUserId: (req as any).user?.userId,
      actorRoles: (req as any).user?.roles,
      action: 'ADMIN_SUBMISSION_DECISION',
      resourceType: 'Submission',
      resourceId: id,
      after: { decision: dto.decision, note: dto.note ?? null },
      ip: (req as any).ip,
      userAgent: (req as any).headers?.['user-agent'],
    });
    return r;
  }

  @Post('submissions/:id/rerun')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async rerun(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AdminRerunDto,
  ) {
    const r = await this.adminService.rerun({ id, types: dto.types });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_SUBMISSION_RERUN',
      resourceType: 'Submission',
      resourceId: id,
      after: { types: dto.types },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post('submissions/:id/publicize')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async publicize(@Req() req: any, @Param('id') id: string) {
    const r = await this.adminService.publicizeSubmission({
      id,
      enabled: true,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_SUBMISSION_PUBLICIZE',
      resourceType: 'Submission',
      resourceId: id,
      after: r,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post('submissions/:id/unpublicize')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async unpublicize(@Req() req: any, @Param('id') id: string) {
    const r = await this.adminService.publicizeSubmission({
      id,
      enabled: false,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_SUBMISSION_UNPUBLICIZE',
      resourceType: 'Submission',
      resourceId: id,
      after: r,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post('submissions/publicize:batch')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async publicizeBatch(@Req() req: any, @Body() dto: AdminPublicizeDto) {
    const r = await this.adminService.publicizeSubmissionsBatch({
      ids: dto.ids,
      enabled: dto.enabled,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_SUBMISSION_PUBLICIZE_BATCH',
      resourceType: 'Submission',
      after: { ...r, idsCount: dto.ids.length, enabled: dto.enabled },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }
}
