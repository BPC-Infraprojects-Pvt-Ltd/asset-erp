import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './http/problem-details.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.use(
    '/api/v1/auth/login',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
  );
  app.use(
    '/api/v1/auth/refresh',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }),
  );
  app.enableCors({
    origin: app.get(ConfigService).get<string>('WEB_ORIGIN') ?? [],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('PORT'));
}
await bootstrap();
