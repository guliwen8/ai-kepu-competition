import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('submissions/:id/latest')
  async latest(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!submission) return null;
    const canRead =
      submission.ownerId === req.user.userId ||
      submission.members.some((m) => m.userId === req.user.userId);
    if (!canRead) return null;

    const reviewCase = await this.prisma.reviewCase.findFirst({
      where: { submissionId: id },
      include: { tasks: true },
      orderBy: { createdAt: 'desc' },
    });
    return reviewCase;
  }
}

