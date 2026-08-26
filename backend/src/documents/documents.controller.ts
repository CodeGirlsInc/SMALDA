import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { join } from 'path';
import { lookup } from 'mime-types';
import * as multer from 'multer';

import { DocumentsService } from './documents.service';
import { DocumentStatus, Document } from './entities/document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { DocumentResponseDto } from './dto/document-response.dto';

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

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  @UsePipes(FileValidationPipe)
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

    // Use a randomized storage key; the client filename is never a path component.
    const storageKey = randomUUID();
    const safeExtension = this.safeExtension(file.mimetype);
    const filename = `${storageKey}${safeExtension}`;
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

    await this.queueService.enqueueAnalyze(document.id, (req as any).requestId);
    return res.status(202).send(document);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listDocuments(
    @Query() query: ListDocumentsDto,
    @Req() req: Request & { user?: User },
  ) {
    const user = req.user!;
    const result = await this.documentsService.findByOwnerPaginated(
      user.id,
      query.page!,
      query.limit!,
      query.status,
    );

    return {
      data: result.data.map(toDocumentResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getDocument(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
  ) {
    const user = req.user!;
    const document = await this.documentsService.findById(id);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    return toDocumentResponse(document);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyDocument(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === DocumentStatus.VERIFIED) {
      throw new ConflictException('Document has already been verified');
    }

    await this.queueService.enqueueAnchor(document.id, (req as any).requestId);

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
      throw new NotFoundException(
        'No verification record found for this document',
      );
    }

    return record;
  }

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const user = req.user!;
    if (document.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.documentsService.revokeAccess(id);
    return { message: 'Access revoked', documentId: updated?.id, status: updated?.status };
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const user = req.user;
    if (!user || document.ownerId !== user.id) {
      throw new NotFoundException('Document not found');
    }

    const stream = createReadStream(document.filePath);
    const contentType =
      lookup(document.filePath) || document.mimeType || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${document.title}"`,
      'X-Content-Type-Options': 'nosniff',
    });

    stream.on('error', () => {
      throw new NotFoundException('File not found on disk');
    });

    stream.pipe(res);
  }

  private safeExtension(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return '.pdf';
      case 'image/png':
        return '.png';
      case 'image/jpeg':
        return '.jpg';
      default:
        return '.bin';
    }
  }
}

function toDocumentResponse(document: Document): DocumentResponseDto {
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    riskScore: document.riskScore,
    riskFlags: document.riskFlags,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
