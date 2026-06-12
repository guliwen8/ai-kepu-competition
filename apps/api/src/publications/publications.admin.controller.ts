import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SubmissionCategory } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { PublicationsService } from './publications.service';

@ApiTags('admin-publications')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/publications')
export class PublicationsAdminController {
  constructor(
    private readonly publicationsService: PublicationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('leaderboard')
  leaderboard(
    @Query('competitionId') competitionId?: string,
    @Query('category') category?: SubmissionCategory,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.publicationsService.getPublicLeaderboard({
      competitionId,
      category,
      page: Number(page),
      pageSize: Number(pageSize),
      requirePublicPhase: false,
    });
  }

  @Get('export')
  async export(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('competitionId') competitionId?: string,
    @Query('category') category?: SubmissionCategory,
  ) {
    const csv = await this.publicationsService.adminExportLeaderboardCsv({
      competitionId,
      category,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="public_leaderboard.csv"`,
    );
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_PUBLICATION_EXPORT',
      resourceType: 'Publication',
      after: {
        competitionId: competitionId ?? null,
        category: category ?? null,
      },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return csv;
  }
}
