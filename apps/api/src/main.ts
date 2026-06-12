import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { MetricsService } from './ops/metrics.service';
import { runWithRequestContext } from './request-context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    exposedHeaders: ['x-request-id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });
  const metrics = app.get(MetricsService);
  app.use((req: any, res: any, next: any) => {
    const raw = req.headers?.['x-request-id'];
    const incoming =
      typeof raw === 'string'
        ? raw.trim()
        : Array.isArray(raw)
          ? String(raw[0] ?? '').trim()
          : '';
    const requestId =
      incoming && incoming.length <= 128 && /^[a-zA-Z0-9._-]+$/.test(incoming)
        ? incoming
        : randomUUID();
    res.setHeader('x-request-id', requestId);
    req.requestId = requestId;
    runWithRequestContext({ requestId }, () => next());
  });
  app.use((req: any, res: any, next: any) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;
      metrics.observe({
        method: req.method,
        path: req.originalUrl ?? req.url ?? '',
        status: res.statusCode,
        durationMs: ms,
      });
    });
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT') ?? 3001;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI科普大赛 API')
    .setVersion('0.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(port);
}
bootstrap();
