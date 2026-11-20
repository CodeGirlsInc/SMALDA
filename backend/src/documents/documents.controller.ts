import {
  BadRequestException,
  Body,
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
import { User, UserRole } from '../users/entities/user.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationCacheService } from '../verification/verification-cache.service';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { MetricsService } from '../metrics/metrics.service';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentLocationDto } from './dto/update-document-location.dto';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_FILE_SIZE_BYTES,
} from '../common/api-contracts';

const ALLOWED_MIME_TYPES = DOCUMENT_ALLOWED_MIME_TYPES;
const MAX_FILE_SIZE_BYTES = DOCUMENT_MAX_FILE_SIZE_BYTES;
const DEFAULT_USER_QUOTA = 20;

const multerStorage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }

  return callback(
    new BadRequestException(
      'Only PDF, PNG, JPEG, or SVG files are allowed',
    ),
  );
};

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly verificationService: VerificationService,
    private readonly verificationCache: VerificationCacheService,
    private readonly accessLogsService: AccessLogsService,
    private readonly metricsService: MetricsService,
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
    @Body() body: CreateDocumentDto = {},
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const user = req.user;
    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    const coordinates = this.parseCoordinates(
      body?.latitude,
      body?.longitude,
    );

    const userQuota =
      this.configService.get<number>('USER_DOCUMENT_QUOTA') ?? DEFAULT_USER_QUOTA;
    const existingDocs = await this.documentsService.findByOwner(user.id);
    if (existingDocs.length >= userQuota) {
      throw new BadRequestException(
        `Upload quota exceeded. Each user may store at most ${userQuota} documents.`,
      );
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.documentsService.findByFileHash(fileHash, req.user.id);
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
      title: body?.title || req.body?.title || file.originalname,
      filePath: targetPath,
      fileHash,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: DocumentStatus.PENDING,
      ...coordinates,
    });

    this.metricsService.incDocumentsSubmitted();
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
      query.search,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
  ) {
    const user = req.user!;
    const document = await this.documentsService.findById(id);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertOwnerOrAdmin(document, user);

    return toDocumentResponse(document);
  }

  @Patch(':id/location')
  @UseGuards(JwtAuthGuard)
  async updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentLocationDto,
    @Req() req: Request & { user?: User },
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertOwnerOrAdmin(document, req.user);

    const { latitude, longitude } = this.parseCoordinates(
      body?.latitude,
      body?.longitude,
      true,
    );
    const updated = await this.documentsService.updateLocation(
      id,
      latitude!,
      longitude!,
    );

    await this.queueService.enqueueAnalyze(id, (req as any).requestId);

    return toDocumentResponse(updated ?? document);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertOwnerOrAdmin(document, req.user);

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
  async getVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertOwnerOrAdmin(document, req.user);

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

    this.assertOwnerOrAdmin(document, req.user);

    const updated = await this.documentsService.revokeAccess(id);
    this.verificationCache.invalidateByDocument(id);
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

    // BE audit — every download is recorded in the access-log trail.
    await this.accessLogsService.logDocumentAccess(
      document.id,
      'download',
      user.id,
      req.ip,
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null,
    );

    // Pre-check that the file exists on disk before creating the stream.
    try {
      await fs.stat(document.filePath);
    } catch {
      throw new NotFoundException('File not found on disk');
    }

    const stream = createReadStream(document.filePath);
    const contentType =
      lookup(document.filePath) || document.mimeType || 'application/octet-stream';

    // Sanitize the filename to prevent header injection via the document title.
    const safeFilename = (document.title || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff',
    });

    stream.pipe(res);
  }

  private parseCoordinates(
    latitude?: unknown,
    longitude?: unknown,
    required = false,
  ): { latitude?: number; longitude?: number } {
    const hasLatitude =
      latitude !== undefined && latitude !== null && latitude !== '';
    const hasLongitude =
      longitude !== undefined && longitude !== null && longitude !== '';

    if (!hasLatitude && !hasLongitude) {
      if (required) {
        throw new BadRequestException('latitude and longitude are required');
      }
      return {};
    }

    if (!hasLatitude || !hasLongitude) {
      throw new BadRequestException(
        'latitude and longitude must be provided together',
      );
    }

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (
      !Number.isFinite(parsedLatitude) ||
      !Number.isFinite(parsedLongitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      throw new BadRequestException('Coordinates are out of range');
    }

    return { latitude: parsedLatitude, longitude: parsedLongitude };
  }

  private assertOwnerOrAdmin(document: Document, user?: User): void {
    if (!user) {
      throw new ForbiddenException('Access denied');
    }
    if (document.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }
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

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toDocumentResponse(document: Document): DocumentResponseDto {
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    riskScore: toNullableNumber(document.riskScore),
    riskFlags: document.riskFlags ?? null,
    fileSize: document.fileSize,
    latitude: toNullableNumber(document.latitude),
    longitude: toNullableNumber(document.longitude),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}