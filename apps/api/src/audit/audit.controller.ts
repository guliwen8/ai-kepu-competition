import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('admin-audit')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Req() _req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('sinceMinutes') sinceMinutes?: string,
  ) {
    return this.auditService.list({
      page: Number(page),
      pageSize: Number(pageSize),
      action,
      resourceType,
      resourceId,
      actorUserId,
      sinceMinutes: sinceMinutes ? Number(sinceMinutes) : undefined,
    });
  }

  @Get('export')
  async export(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('sinceMinutes') sinceMinutes?: string,
  ) {
    const csv = await this.auditService.exportCsv({
      action,
      resourceType,
      resourceId,
      actorUserId,
      sinceMinutes: sinceMinutes ? Number(sinceMinutes) : undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs.csv"`);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_AUDIT_EXPORT',
      resourceType: 'AuditLog',
      after: {
        action: action ?? null,
        resourceType: resourceType ?? null,
        resourceId: resourceId ?? null,
        actorUserId: actorUserId ?? null,
        sinceMinutes: sinceMinutes ?? null,
      },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return csv;
  }
}
