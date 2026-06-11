import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AttachmentKind } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateSubmissionDto) {
    const r = await this.submissionsService.createDraft(req.user.userId, dto as any);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'PARTICIPANT_SUBMISSION_CREATE_DRAFT',
      resourceType: 'Submission',
      resourceId: (r as any)?.id ?? null,
      after: { id: (r as any)?.id ?? null, category: (dto as any)?.category ?? null },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Get('my')
  my(@Req() req: { user: { userId: string } }) {
    return this.submissionsService.mySubmissions(req.user.userId);
  }

  @Get(':id')
  get(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.submissionsService.getById(req.user.userId, id);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSubmissionDto) {
    const r = await this.submissionsService.updateDraft(req.user.userId, id, dto as any);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'PARTICIPANT_SUBMISSION_UPDATE_DRAFT',
      resourceType: 'Submission',
      resourceId: id,
      after: { id },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @ApiConsumes('multipart/form-data')
  @Post(':id/attachments/:kind')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const base = resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads');
          const dir = resolve(base, (req as any).params?.id ?? 'unknown');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: {
        fileSize: 600 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @Req() req: any,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const k = (AttachmentKind as any)[kind as any] as AttachmentKind | undefined;
    if (!k) {
      throw new BadRequestException('无效的 kind');
    }
    if (!file) throw new BadRequestException('缺少文件');

    const meta: Record<string, unknown> = {};
    if (req.body?.durationSec) meta.durationSec = Number(req.body.durationSec);
    if (req.body?.width) meta.width = Number(req.body.width);
    if (req.body?.height) meta.height = Number(req.body.height);

    const r = await this.submissionsService.addAttachment(req.user.userId, id, {
      kind: k,
      originalName: file.originalname,
      storedPath: file.path,
      mimeType: file.mimetype,
      byteSize: file.size,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'PARTICIPANT_SUBMISSION_UPLOAD_ATTACHMENT',
      resourceType: 'Submission',
      resourceId: id,
      after: {
        id,
        kind: k,
        mimeType: file.mimetype,
        byteSize: file.size,
      },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }

  @Post(':id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    const r = await this.submissionsService.submit(req.user.userId, id);
    await this.auditService.write({
      actorUserId: req.user?.userId,
      actorRoles: req.user?.roles,
      action: 'PARTICIPANT_SUBMISSION_SUBMIT',
      resourceType: 'Submission',
      resourceId: id,
      after: { id },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return r;
  }
}
