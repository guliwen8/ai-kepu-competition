import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';

@ApiTags('competitions')
@Controller('competitions')
export class CompetitionsPublicController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Get('current')
  current() {
    return this.competitionsService.getCurrent();
  }
}
