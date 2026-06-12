import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JudgingAdminController } from './judging.admin.controller';
import { JudgingJudgeController } from './judging.judge.controller';
import { JudgingService } from './judging.service';

@Module({
  imports: [PrismaModule],
  controllers: [JudgingAdminController, JudgingJudgeController],
  providers: [JudgingService],
})
export class JudgingModule {}
