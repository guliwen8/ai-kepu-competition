import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsPublicController } from './competitions.public.controller';
import { CompetitionsService } from './competitions.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompetitionsController, CompetitionsPublicController],
  providers: [CompetitionsService],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
