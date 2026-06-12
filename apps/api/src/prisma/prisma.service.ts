import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MetricsService } from '../ops/metrics.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(metrics: MetricsService) {
    super();
    const extended = this.$extends({
      query: {
        $allOperations: async ({ model, operation, query, args }) => {
          const startedAt = Date.now();
          try {
            const result = await query(args);
            const durationMs = Date.now() - startedAt;
            metrics.observeDb({
              model: model ?? 'raw',
              action: operation ?? 'unknown',
              durationMs,
              ok: true,
            });
            return result;
          } catch (e) {
            const durationMs = Date.now() - startedAt;
            metrics.observeDb({
              model: model ?? 'raw',
              action: operation ?? 'unknown',
              durationMs,
              ok: false,
            });
            throw e;
          }
        },
      },
    });
    (extended as any).onModuleInit = this.onModuleInit.bind(extended);
    (extended as any).onModuleDestroy = this.onModuleDestroy.bind(extended);
    return extended as any;
  }

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      return;
    }
    try {
      await this.$connect();
    } catch {
      console.error('Prisma connect failed');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
