import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import { Document } from './entities/document.entity';

/** Builds the Excel and PDF renderings of documents. Pure: no DB access. */
@Injectable()
export class DocumentExportService {
  async toExcel(documents: Document[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Documents');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Risk score', key: 'riskScore', width: 12 },
      { header: 'Risk flags', key: 'riskFlags', width: 50 },
      { header: 'Size (bytes)', key: 'fileSize', width: 14 },
      { header: 'Created', key: 'createdAt', width: 24 },
    ];
    for (const d of documents) {
      sheet.addRow({
        id: d.id,
        title: d.title,
        status: d.status,
        riskScore: d.riskScore ?? '',
        riskFlags: (d.riskFlags ?? []).join(', '),
        fileSize: d.fileSize,
        createdAt: d.createdAt,
      });
    }
    sheet.getRow(1).font = { bold: true };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** PDF with one block per document; resolves with the whole file. */
  toPdf(documents: Document[], heading: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      pdf.fontSize(18).text(heading);
      pdf.moveDown();
      for (const d of documents) {
        pdf.fontSize(12).text(d.title, { underline: true });
        pdf
          .fontSize(10)
          .text(`ID: ${d.id}`)
          .text(`Status: ${d.status}`)
          .text(`Risk score: ${d.riskScore ?? 'n/a'}`)
          .text(`Risk flags: ${(d.riskFlags ?? []).join(', ') || 'none'}`)
          .text(`Created: ${new Date(d.createdAt).toISOString()}`);
        pdf.moveDown();
      }
      if (documents.length === 0) pdf.fontSize(10).text('No documents.');
      pdf.end();
    });
  }
}
