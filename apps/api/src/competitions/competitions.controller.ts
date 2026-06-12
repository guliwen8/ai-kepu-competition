import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CompetitionsService } from './competitions.service';

@ApiTags('admin-competitions')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/competitions')
export class CompetitionsController {
  constructor(
    private readonly competitionsService: CompetitionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list() {
    return this.competitionsService.list();
  }

  @Get('current')
  current() {
    return this.competitionsService.getCurrent();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.competitionsService.getById(id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateCompetitionDto) {
    const r = await this.competitionsService.create(dto);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_COMPETITION_CREATE',
      resourceType: 'Competition',
      resourceId: (r as any).id,
      after: dto,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCompetitionDto,
  ) {
    const r = await this.competitionsService.update(id, dto);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_COMPETITION_UPDATE',
      resourceType: 'Competition',
      resourceId: id,
      after: dto,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post(':id/set-current')
  async setCurrent(@Req() req: any, @Param('id') id: string) {
    const r = await this.competitionsService.setCurrent(id);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'ADMIN_COMPETITION_SET_CURRENT',
      resourceType: 'Competition',
      resourceId: id,
      after: r,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }
}
