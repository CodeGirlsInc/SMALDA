import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

@Injectable()
export class ExportService {
  constructor(private readonly documentsService: DocumentsService) {}

  async exportToPdf(documentId: string): Promise<Buffer> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Document Export', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text('Title:');
      doc.fontSize(12).text(document.title);
      doc.moveDown();

      doc.fontSize(14).text('File Hash:');
      doc.fontSize(12).text(document.fileHash);
      doc.moveDown();

      doc.fontSize(14).text('Status:');
      doc.fontSize(12).text(document.status);
      doc.moveDown();

      doc.fontSize(14).text('Risk Score:');
      doc.fontSize(12).text(document.riskScore != null ? String(document.riskScore) : 'N/A');
      doc.moveDown();

      doc.fontSize(14).text('Risk Flags:');
      doc.fontSize(12).text(
        document.riskFlags && document.riskFlags.length > 0 ? document.riskFlags.join(', ') : 'None',
      );
      doc.moveDown();

      doc.fontSize(14).text('Created At:');
      doc.fontSize(12).text(document.createdAt.toISOString());
      doc.moveDown();

      doc.fontSize(14).text('Updated At:');
      doc.fontSize(12).text(document.updatedAt.toISOString());

      doc.end();
    });
  }

  async exportToExcel(documentId: string): Promise<Buffer> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SMALDA';
    const worksheet = workbook.addWorksheet('Document');

    worksheet.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Value', key: 'value', width: 60 },
    ];

    const rows = [
      { field: 'ID', value: document.id },
      { field: 'Title', value: document.title },
      { field: 'File Hash', value: document.fileHash },
      { field: 'File Size', value: String(document.fileSize) },
      { field: 'MIME Type', value: document.mimeType },
      { field: 'Status', value: document.status },
      { field: 'Risk Score', value: document.riskScore != null ? String(document.riskScore) : 'N/A' },
      { field: 'Risk Flags', value: document.riskFlags ? document.riskFlags.join(', ') : 'None' },
      { field: 'Created At', value: document.createdAt.toISOString() },
      { field: 'Updated At', value: document.updatedAt.toISOString() },
    ];

    rows.forEach((row) => worksheet.addRow(row));

    worksheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
