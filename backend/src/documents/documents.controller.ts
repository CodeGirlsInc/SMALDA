import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as multer from 'multer';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

import { DocumentsService } from './documents.service';
import { DocumentStatus } from './entities/document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const multerStorage = multer.memoryStorage();

const fileFilter: multer.FileFilterCallback = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(null, true);
  }
  return callback(new BadRequestException('Only PDF, PNG, or JPEG files are allowed'), false);
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
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: multerStorage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @ApiOperation({ summary: 'Upload a document for analysis' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 202, description: 'Document accepted for processing' })
  @ApiResponse({ status: 200, description: 'Document already exists (duplicate)' })
  @ApiResponse({ status: 400, description: 'Invalid file type or missing file' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const user = req.user;
    if (!user) throw new BadRequestException('Authenticated user is required');

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.documentsService.findByFileHash(fileHash);
    if (existing) return res.status(200).send(existing);

    const uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${fileHash}${extname(file.originalname) || ''}`;
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

  // BE-39: Excel export — static route must come before dynamic :id routes
  @Get('export/excel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export all user documents as Excel (.xlsx)' })
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportExcel(@Req() req: Request & { user?: User }, @Res() res: Response) {
    const documents = await this.documentsService.findByOwner(req.user!.id);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Documents');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Risk Score', key: 'riskScore', width: 12 },
      { header: 'Risk Flags', key: 'riskFlags', width: 40 },
      { header: 'Uploaded At', key: 'createdAt', width: 24 },
    ];
    documents.forEach((doc) =>
      sheet.addRow({
        ...doc,
        riskFlags: doc.riskFlags?.join(', ') ?? '',
      }),
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="documents.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Queue a document for Stellar blockchain verification' })
  @ApiResponse({ status: 202, description: 'Verification queued' })
  @ApiResponse({ status: 403, description: 'Not the document owner' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 409, description: 'Already verified' })
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
    return res.status(202).json({ message: 'Verification queued', documentId: document.id });
  }

  @Get(':id/verification')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the latest verification record for a document' })
  @ApiResponse({ status: 200, description: 'Verification record' })
  @ApiResponse({ status: 404, description: 'Document or record not found' })
  async getVerification(@Param('id') id: string) {
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
