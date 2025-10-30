import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { json, urlencoded } from 'body-parser';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Debug inicial de vars críticas (no imprimir secretos completos en producción)
  if (process.env.NODE_ENV !== 'production') {
    // Mostrar sólo los nombres y scopes requeridos
    console.log('[BOOT] FIGMA_SCOPES =', process.env.FIGMA_SCOPES);
    console.log('[BOOT] GOOGLE_CLIENT_ID set?', !!process.env.GOOGLE_CLIENT_ID);
  }
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      // In dev, allow undefined origin (curl, Postman)
      if (!origin) return callback(null, true);
      const allowed = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error('CORS not allowed'));
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));

  const config = new DocumentBuilder()
    .setTitle('Analytics Weaver API')
    .setDescription('API para gestión de medición, integraciones y verificación')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap();
