import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/configuration';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const api = config.get('api', { infer: true });

  // ── Security hardening + performance ────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({ origin: api.corsOrigins, credentials: true });

  app.setGlobalPrefix(api.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Strip unknown props, reject unexpected ones, coerce types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);
  app.enableShutdownHooks();

  // ── OpenAPI docs ────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Canva Clone Pro API')
    .setDescription('REST API for the Canva Clone Pro design platform.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${api.globalPrefix}/docs`, app, document);

  await app.listen(api.port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${api.port}/${api.globalPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs at http://localhost:${api.port}/${api.globalPrefix}/docs`);
}

void bootstrap();
