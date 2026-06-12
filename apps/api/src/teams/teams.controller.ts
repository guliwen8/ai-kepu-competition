import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTeamDto) {
    const r = await this.teamsService.create(req.user.userId, dto.name);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'PARTICIPANT_TEAM_CREATE',
      resourceType: 'Team',
      resourceId: (r as any)?.id ?? null,
      after: { id: (r as any)?.id ?? null },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post(':id/members')
  async addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    const r = await this.teamsService.addMember(
      req.user.userId,
      id,
      dto.phone,
      dto.role,
    );
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'PARTICIPANT_TEAM_ADD_MEMBER',
      resourceType: 'Team',
      resourceId: id,
      after: { id, role: dto.role },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Get('my')
  my(@Req() req: { user: { userId: string } }) {
    return this.teamsService.myTeams(req.user.userId);
  }
}
