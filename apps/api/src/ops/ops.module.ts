import { Global, Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [OpsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class OpsModule {}
