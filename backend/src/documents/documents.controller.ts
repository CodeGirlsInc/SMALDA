import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as multer from 'multer';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';                          // BE-20: UUID filenames

import { DocumentsService } from './documents.service';
import { DocumentStatus } from './entities/document.entity';
import { DocumentResponseDto, UpdateDocumentStatusDto } from './dto/document-request-response.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedUserGuard } from '../auth/guards/verified-user.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationResponseDto } from '../verification/dto/verification-response.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { MagicBytesInterceptor } from './upload.config';      // BE-20: magic-bytes check

// ─── BE-20: Extension + declared-MIME whitelist ───────────────────────────────
// Keyed by extension; value is the only accepted MIME for that extension.
const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// memoryStorage keeps the buffer available for both hashing and magic-bytes check
const multerStorage = multer.memoryStorage();

// BE-20: replaces the old ALLOWED_MIME_TYPES-only check with extension+MIME pairing
const fileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  const ext = extname(file.originalname).toLowerCase();
  const expectedMime = ALLOWED_EXTENSIONS[ext];

  if (!expectedMime) {
    return callback(
      new BadRequestException(
        `Extension "${ext}" is not allowed. Accepted: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}`,
      ),
      false,
    );
  }

  if (file.mimetype !== expectedMime) {
    return callback(
      new BadRequestException(
        `Declared MIME type "${file.mimetype}" does not match extension "${ext}"`,
      ),
      false,
    );
  }

  return callback(null, true);
};

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly verificationService: VerificationService,
    private readonly auditService: AuditService,
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
  @UseGuards(VerifiedUserGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerStorage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
    MagicBytesInterceptor, // BE-20: magic-bytes check runs after multer buffers the file
  )
  @ApiOperation({ summary: 'Upload a document for analysis' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 202, description: 'Document accepted for processing', type: DocumentResponseDto })
  @ApiResponse({ status: 200, description: 'Document already exists (duplicate)', type: DocumentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type, spoofed content, or missing file' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const user = req.user;
    if (!user) throw new BadRequestException('Authenticated user is required');

    // Hash the content for deduplication (unchanged)
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.documentsService.findByFileHash(fileHash);
    if (existing) return res.status(200).send(existing);

    // BE-20: store under UUID name — not originalname, not the hash.
    // UPLOAD_DIR must be outside the web root (set via env).
    const uploadDir = this.configService.get<string>('UPLOAD_DIR') || './private-uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = extname(file.originalname).toLowerCase();
    const safeFilename = `${uuidv4()}${ext}`;          // UUID — no path traversal possible
    const targetPath = join(uploadDir, safeFilename);
    await fs.writeFile(targetPath, file.buffer);

    const document = await this.documentsService.create({
      ownerId: user.id,
      title: file.originalname,   // display-only; never used as a filesystem path
      filePath: targetPath,
      fileHash,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: DocumentStatus.PENDING,
    });

    await this.queueService.enqueueAnalyze(document.id);
    await this.auditService.log(user.id, AuditAction.DOCUMENT_UPLOAD, 'document', document.id, {
      fileName: file.originalname,
      mimeType: file.mimetype,
    });

    return res.status(202).send(document);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteDocument(@Param('id') id: string, @Req() req: Request & { user?: User }) {
    const document = await this.documentsService.findById(id);
    if (!document) throw new NotFoundException('Document not found');

    const isAdmin = req.user!.role === UserRole.ADMIN;
    if (document.ownerId !== req.user!.id && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    await this.documentsService.delete(id);
    await this.auditService.log(req.user!.id, AuditAction.DOCUMENT_DELETE, 'document', id);
    return { message: 'Document deleted' };
  }

  @Get(':id/file')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download the original document file' })
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Document or file not found' })
  async downloadFile(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const document = await this.documentsService.findById(id);
    if (!document) throw new NotFoundException('Document not found');

    const isAdmin = req.user!.role === UserRole.ADMIN;
    if (document.ownerId !== req.user!.id && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    try {
      await fs.access(document.filePath);
    } catch {
      throw new NotFoundException('File not found on disk');
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.title}"`);
    return new StreamableFile(createReadStream(document.filePath));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single document by ID' })
  @ApiResponse({ status: 200, description: 'Document record' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(@Param('id') id: string, @Req() req: Request & { user?: User }) {
    const document = await this.documentsService.findById(id);
    if (!document) throw new NotFoundException('Document not found');

    const isAdmin = req.user!.role === UserRole.ADMIN;
    if (document.ownerId !== req.user!.id && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return document;
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyDocument(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findById(id);
    if (!document) throw new NotFoundException('Document not found');
    if (document.ownerId !== req.user?.id) throw new ForbiddenException('Access denied');
    if (document.status === DocumentStatus.VERIFIED) throw new ConflictException('Document has already been verified');

    await this.queueService.enqueueAnchor(document.id);
    await this.auditService.log(req.user!.id, AuditAction.VERIFICATION_TRIGGER, 'document', id);

    return res.status(202).json({
      message: 'Verification queued',
      documentId: document.id,
    });
  }

  @Get(':id/verification')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the latest verification record for a document' })
  @ApiResponse({ status: 200, type: VerificationResponseDto })
  @ApiResponse({ status: 404, description: 'Document or record not found' })
  async getVerification(@Param('id') id: string): Promise<VerificationResponseDto> {
    const document = await this.documentsService.findById(id);
    if (!document) throw new NotFoundException('Document not found');

    const record = await this.verificationService.findLatestByDocument(id);
    if (!record) throw new NotFoundException('No verification record found for this document');

    return record;
  }

  // BE-39: PDF export
  @Get(':id/export/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export a single document report as PDF' })
  @ApiResponse({ status: 200, description: 'PDF file download' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentsService.findById(id);
    if (!document) throw new NotFoundException('Document not found');

    const verification = await this.verificationService.findLatestByDocument(id);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.title}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).text('Document Report', { align: 'center' }).moveDown();
    doc.fontSize(12)
      .text(`Title: ${document.title}`)
      .text(`Uploaded: ${document.createdAt.toISOString()}`)
      .text(`Status: ${document.status}`)
      .text(`Risk Score: ${document.riskScore ?? 'N/A'}`)
      .text(`Risk Flags: ${document.riskFlags?.join(', ') || 'None'}`)
      .moveDown()
      .text(`Stellar Tx Hash: ${verification?.stellarTxHash ?? 'Not anchored'}`)
      .text(`Stellar Ledger: ${verification?.stellarLedger ?? 'N/A'}`);

    doc.end();
  }
}