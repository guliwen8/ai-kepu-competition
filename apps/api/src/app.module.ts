import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { TeamsModule } from './teams/teams.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AiModule } from './ai/ai.module';
import { JudgingModule } from './judging/judging.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { PublicationsModule } from './publications/publications.module';
import { AuditModule } from './audit/audit.module';
import { OpsModule } from './ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (() => {
        const candidates = [
          resolve(process.cwd(), '../../.env'),
          resolve(process.cwd(), '../.env'),
          resolve(process.cwd(), '.env'),
        ];
        return candidates.find((p) => existsSync(p)) ?? candidates[candidates.length - 1];
      })(),
    }),
    AdminModule,
    AuthModule,
    PrismaModule,
    RedisModule,
    AiModule,
    StorageModule,
    TeamsModule,
    SubmissionsModule,
    ReviewsModule,
    JudgingModule,
    CompetitionsModule,
    PublicationsModule,
    AuditModule,
    OpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
