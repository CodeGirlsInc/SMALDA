 import { NestFactory } from '@nestjs/core';
 import { AppModule } from './app.module';
 import { ValidationPipe } from '@nestjs/common';
 import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
 import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL') || 'http://localhost:3001',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

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

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SMALDA Authentication API')
    .setDescription(
      'Comprehensive authentication and authorization API with JWT, OAuth, and RBAC',
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.get<number>('APP_PORT') || 3000;
  await app.listen(port);
  
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
