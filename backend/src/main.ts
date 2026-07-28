import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WinstonModule } from 'nest-winston';
import { buildWinstonOptions } from './common/logger.config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

async function bootstrap() {
  const logger = WinstonModule.createLogger(buildWinstonOptions());
  const app = await NestFactory.create(AppModule, { logger });

  const configService = app.get(ConfigService);

  app.enableCors({
    origin:
      configService.get<string>('FRONTEND_URL') || 'http://localhost:3001',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(
    new HttpExceptionFilter(
      configService.get<string>('NODE_ENV') === 'production',
    ),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SMALDA — Secure Land Document Verification API')
    .setDescription(
      'End-to-end platform for land document verification, risk assessment, and blockchain anchoring on Stellar.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Login, register, OAuth, and token management')
    .addTag('Users', 'User profiles and account management')
    .addTag('Documents', 'Document upload, retrieval, and lifecycle')
    .addTag('Risk Assessment', 'Automated document risk scoring and flagging')
    .addTag('Verification', 'Stellar blockchain anchoring and verification records')
    .addTag('Disputes', 'Dispute filing and resolution')
    .addTag('External Validation', 'Land registry, government ID, and business registration checks')
    .addTag('Access Logs', 'Document access audit trail')
    .addTag('Stellar', 'Blockchain anchoring operations')
    .addTag('Queue', 'Document processing queue management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('APP_PORT') || 6004;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    console.log('Stopping accepting new connections...');
    await app.close();
    console.log('All connections closed. Exiting.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
bootstrap();
