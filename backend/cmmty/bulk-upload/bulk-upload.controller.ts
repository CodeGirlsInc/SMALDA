import {
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as multer from 'multer';

import { BulkUploadService, BulkUploadResult } from './bulk-upload.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

const multerStorage = multer.memoryStorage();

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('documents')
export class BulkUploadController {
  constructor(
    private readonly bulkUploadService: BulkUploadService,
    private readonly configService: ConfigService,
  ) {}

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerStorage,
    }),
  )
  async bulkUploadDocuments(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthenticatedRequest,
  ): Promise<BulkUploadResult> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const user = req.user;
    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    const uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';

    return this.bulkUploadService.processBulkUpload(files, user.id, uploadDir);
  }
}
