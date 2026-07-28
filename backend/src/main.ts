import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { WinstonModule } from 'nest-winston';
import { buildWinstonOptions } from './common/logger.config';
import { buildCorsOptions } from './common/cors.config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

async function bootstrap() {
  const logger = WinstonModule.createLogger(buildWinstonOptions());
  const app = await NestFactory.create(AppModule, { logger });

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  // Enable hardened CORS
  const { corsOptions } = buildCorsOptions(configService);
  app.enableCors(corsOptions);

  // Global prefix & URI versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Global validation pipe
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
    .setTitle('SMALDA Land Management Platform API')
    .setDescription(
      'Comprehensive Land Record Management API covering Documents, Risk Assessment, Verification, Disputes, External Validation, Access Logs, and Stellar Anchoring',
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
    .addTag('Authentication', 'Authentication endpoints (login, register, OAuth, etc.)')
    .addTag('Users', 'User management and profile endpoints')
    .addTag('Documents', 'Land document management endpoints')
    .addTag('Risk Assessment', 'Automated document risk evaluation')
    .addTag('Verification', 'Public and internal record verification')
    .addTag('Disputes', 'Land title dispute resolution endpoints')
    .addTag('External Validation', 'Registry external validation')
    .addTag('Access Logs', 'Audit logging endpoints')
    .addTag('Stellar', 'Blockchain anchoring endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.get<number>('APP_PORT') || 6004;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
