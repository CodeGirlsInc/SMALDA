import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';
import { DocumentUploadController } from './document-upload.controller';
import { DocumentUploadService } from './document-upload.service';
import { UploadedDocument } from './entities/uploaded-document.entity';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UploadedDocument]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const uploadDir = resolve(
              configService.get<string>('UPLOAD_DIR') || './uploads',
            );
            mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
          },
          filename: (_req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = extname(file.originalname);
            cb(null, `${uniqueSuffix}${ext}`);
          },
        }),
        fileFilter: (_req, file, cb) => {
          if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(
              new BadRequestException(
                `Unsupported file type "${file.mimetype}". Accepted types: ${ALLOWED_MIME_TYPES.join(', ')}`,
              ),
              false,
            );
          }
        },
        limits: {
          fileSize: MAX_FILE_SIZE_BYTES,
        },
      }),
    }),
  ],
  controllers: [DocumentUploadController],
  providers: [DocumentUploadService],
  exports: [DocumentUploadService],
})
export class DocumentUploadModule {}
