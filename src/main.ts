try {
  require('dotenv').config();
} catch {
  // Production containers pass env vars directly and may not include dotenv.
}
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind the load balancer (and the frontend's /api relay): trust
  // X-Forwarded-For only from these addresses, so req.ip is the real client
  // (login rate limiting and audit logs depend on it).
  const trustedProxies = (process.env.TRUST_PROXY ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (trustedProxies.length > 0) app.set('trust proxy', trustedProxies);

  // Close the HTTP server and Prisma cleanly on SIGTERM (docker stop / deploys).
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.use(cookieParser());
  app.use(helmet());
  app.use(compression());

  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsCredentials = process.env.CORS_CREDENTIALS === 'true';
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : corsCredentials ? false : true,
    credentials: corsCredentials,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    exposedHeaders: ['set-cookie'],
  });

  const swaggerEnabled =
    process.env.SWAGGER_ENABLED !== undefined
      ? process.env.SWAGGER_ENABLED === 'true'
      : process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Training Management API')
      .setDescription('API for the TTRI Training Management System')
      .setVersion('1.0')
      .addCookieAuth('staff_session')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/document', app, document);
  }

  await app.listen(process.env.PORT ?? 8090);
}
bootstrap();
