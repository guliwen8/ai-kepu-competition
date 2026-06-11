import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from './metrics.service';

@ApiTags('ops')
@Controller()
export class OpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('healthz')
  async healthz() {
    let dbOk = false;
    let redisOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    try {
      await this.redis.client.ping();
      redisOk = true;
    } catch {
      redisOk = false;
    }
    return { ok: dbOk && redisOk, db: { ok: dbOk }, redis: { ok: redisOk } };
  }

  @Get('metrics')
  metricsProm(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return this.metrics.renderProm();
  }
}

