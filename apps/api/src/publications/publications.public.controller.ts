import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubmissionCategory } from '@prisma/client';
import { PublicationsService } from './publications.service';

@ApiTags('publications')
@Controller('public')
export class PublicationsPublicController {
  constructor(private readonly publicationsService: PublicationsService) {}

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
    });
  }

  @Get('submissions/:id')
  submission(@Param('id') id: string) {
    return this.publicationsService.getPublicSubmissionDetail({
      submissionId: id,
    });
  }
}
