import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as multer from 'multer';

import { DocumentsService } from './documents.service';
import { Throttle } from '@nestjs/throttler';
import { DocumentStatus } from './entities/document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const multerStorage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }

  return callback(
    new BadRequestException('Only PDF, PNG, or JPEG files are allowed'),
  );
};

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly verificationService: VerificationService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
    @UploadedFile() file: Express.Multer.File,
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

    const uploadDir =
      this.configService.get<string>('UPLOAD_DIR') || './uploads';
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyDocuments(
    @Query() query: PaginationDto,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    const result = await this.documentsService.findByOwnerPaginated(user.id, query);
    return res.status(200).json(result);
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
      throw new NotFoundException(
        'No verification record found for this document',
      );
    }

    return record;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async search(@Query() query: SearchDocumentsDto, @Res() res: Response) {
    const result = await this.documentsService.search(query);
    return res.status(200).json(result);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadBulk(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const user = req.user;
    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    const created = await this.documentsService.bulkCreate(files, user.id);
    return res.status(201).json(created);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentStatusDto,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.updateStatus(
      id,
      dto.status as DocumentStatus,
    );
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return res.status(200).json(document);
  }
}
