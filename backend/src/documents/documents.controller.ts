import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as multer from 'multer';

import { DocumentsService } from './documents.service';
import { DocumentStatus } from './entities/document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const multerStorage = multer.memoryStorage();

const fileFilter: multer.FileFilterCallback = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }

  return callback(new BadRequestException('Only PDF, PNG, or JPEG files are allowed'), false);
};

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly verificationService: VerificationService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listDocuments(
    @Query() query: QueryDocumentsDto,
    @Req() req: Request & { user?: User },
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    return this.documentsService.findWithFilters(query, user.id, isAdmin);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: any,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const user = req.user;
    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.documentsService.findByFileHash(fileHash);
    if (existing) {
      return res.status(200).send(existing);
    }

    const uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    const extension = extname(file.originalname) || '';
    const filename = `${fileHash}${extension}`;
    const targetPath = join(uploadDir, filename);
    await fs.writeFile(targetPath, file.buffer);

    const document = await this.documentsService.create({
      ownerId: user.id,
      title: file.originalname,
      filePath: targetPath,
      fileHash,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: DocumentStatus.PENDING,
    });

    await this.queueService.enqueueAnalyze(document.id);
    return res.status(202).send(document);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyDocument(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === DocumentStatus.VERIFIED) {
      throw new ConflictException('Document has already been verified');
    }

    await this.queueService.enqueueAnchor(document.id);

    return res.status(202).json({
      message: 'Verification queued',
      documentId: document.id,
    });
  }

  @Get(':id/verification')
  @UseGuards(JwtAuthGuard)
  async getVerification(@Param('id') id: string) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const record = await this.verificationService.findLatestByDocument(id);
    if (!record) {
      throw new NotFoundException('No verification record found for this document');
    }

    return record;
  }
}
