/**
 * Exports the OpenAPI schema to a JSON file.
 *
 * Usage:
 *   npx ts-node scripts/export-openapi.ts
 *
 * The generated file can be consumed by frontend code generators
 * (e.g., openapi-typescript) to produce type-safe API clients.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function exportSchema() {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('SMALDA — Secure Land Document Verification API')
    .setDescription('End-to-end platform for land document verification, risk assessment, and blockchain anchoring on Stellar.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', in: 'header' }, 'JWT-auth')
    .addTag('Authentication')
    .addTag('Users')
    .addTag('Documents')
    .addTag('Risk Assessment')
    .addTag('Verification')
    .addTag('Disputes')
    .addTag('External Validation')
    .addTag('Access Logs')
    .addTag('Queue')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = join(__dirname, '..', 'openapi.json');
  await writeFile(outputPath, JSON.stringify(document, null, 2));

  console.log(`OpenAPI schema exported to ${outputPath}`);
  await app.close();
}

exportSchema().catch((err) => {
  console.error('Failed to export OpenAPI schema:', err);
  process.exit(1);
});
