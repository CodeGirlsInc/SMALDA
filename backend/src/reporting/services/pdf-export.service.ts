import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface PDFOptions {
  title: string;
  author?: string;
  subject?: string;
  keywords?: string;
}

@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);
  private readonly outputDir = path.join(process.cwd(), 'reports');

  constructor() {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateDocumentVerificationReport(
    data: any,
    options: PDFOptions,
  ): Promise<string> {
    this.logger.log(`Generating document verification PDF report: ${options.title}`);

    const fileName = `doc-verification-${Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);

      doc.pipe(stream);

      // Header
      this.addHeader(doc, options.title, options.subject);

      // Summary Section
      doc.fontSize(16).text('Verification Summary', { underline: true });
      doc.moveDown();

      const summary = data.summary || {};
      doc.fontSize(12);
      doc.text(`Total Verifications: ${summary.totalVerifications || 0}`);
      doc.text(`Successful: ${summary.successfulVerifications || 0}`);
      doc.text(`Failed: ${summary.failedVerifications || 0}`);
      doc.text(`Success Rate: ${summary.successRate || 0}%`);
      doc.moveDown();

      // Date Range
      if (data.startDate && data.endDate) {
        doc.fontSize(10).fillColor('#666');
        doc.text(`Period: ${data.startDate} to ${data.endDate}`);
        doc.fillColor('#000');
        doc.moveDown();
      }

      // Transactions Table
      if (data.transactions && data.transactions.length > 0) {
        doc.fontSize(16).text('Recent Verifications', { underline: true });
        doc.moveDown();

        this.addTable(doc, data.transactions.slice(0, 20), [
          { key: 'documentHash', label: 'Document Hash', width: 150 },
          { key: 'status', label: 'Status', width: 80 },
          { key: 'network', label: 'Network', width: 80 },
          { key: 'createdAt', label: 'Date', width: 120 },
        ]);
      }

      // Footer
      this.addFooter(doc);

      doc.end();
    });
  }

  async generateUserActivityReport(
    data: any,
    options: PDFOptions,
  ): Promise<string> {
    this.logger.log(`Generating user activity PDF report: ${options.title}`);

    const fileName = `user-activity-${Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);

      doc.pipe(stream);

      // Header
      this.addHeader(doc, options.title, options.subject);

      // Summary Section
      doc.fontSize(16).text('User Activity Summary', { underline: true });
      doc.moveDown();

      const summary = data.summary || {};
      doc.fontSize(12);
      doc.text(`Total Users: ${summary.totalUsers || 0}`);
      doc.text(`Active Users: ${summary.activeUsers || 0}`);
      doc.text(`New Users Today: ${summary.newUsersToday || 0}`);
      doc.text(`New Users This Week: ${summary.newUsersThisWeek || 0}`);
      doc.text(`New Users This Month: ${summary.newUsersThisMonth || 0}`);
      doc.moveDown();

      // Most Active Users
      if (data.mostActiveUsers && data.mostActiveUsers.length > 0) {
        doc.fontSize(16).text('Most Active Users', { underline: true });
        doc.moveDown();

        this.addTable(doc, data.mostActiveUsers, [
          { key: 'email', label: 'Email', width: 200 },
          { key: 'activityCount', label: 'Activity Count', width: 100 },
        ]);
      }

      // Footer
      this.addFooter(doc);

      doc.end();
    });
  }

  async generateSystemAnalyticsReport(
    data: any,
    options: PDFOptions,
  ): Promise<string> {
    this.logger.log(`Generating system analytics PDF report: ${options.title}`);

    const fileName = `system-analytics-${Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);

      doc.pipe(stream);

      // Header
      this.addHeader(doc, options.title, options.subject);

      // Summary Section
      doc.fontSize(16).text('System Analytics', { underline: true });
      doc.moveDown();

      const summary = data.summary || {};
      doc.fontSize(12);
      doc.text(`Total Transactions: ${summary.totalTransactions || 0}`);
      doc.text(`Transactions Today: ${summary.transactionsToday || 0}`);
      doc.text(`Transactions This Week: ${summary.transactionsThisWeek || 0}`);
      doc.text(`Transactions This Month: ${summary.transactionsThisMonth || 0}`);
      doc.text(`Average Fee: ${summary.averageTransactionFee || '0'} XLM`);
      doc.moveDown();

      // Network Distribution
      if (data.networkDistribution && data.networkDistribution.length > 0) {
        doc.fontSize(16).text('Network Distribution', { underline: true });
        doc.moveDown();

        data.networkDistribution.forEach((item: any) => {
          doc.fontSize(12).text(`${item.network}: ${item.count}`);
        });
        doc.moveDown();
      }

      // Status Distribution
      if (data.statusDistribution && data.statusDistribution.length > 0) {
        doc.fontSize(16).text('Status Distribution', { underline: true });
        doc.moveDown();

        data.statusDistribution.forEach((item: any) => {
          doc.fontSize(12).text(`${item.status}: ${item.count}`);
        });
        doc.moveDown();
      }

      // Footer
      this.addFooter(doc);

      doc.end();
    });
  }

  private addHeader(doc: typeof PDFDocument, title: string, subject?: string) {
    doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
    
    if (subject) {
      doc.fontSize(12).font('Helvetica').text(subject, { align: 'center' });
    }

    doc.fontSize(10).fillColor('#666');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.fillColor('#000');
    
    doc.moveDown(2);
  }

  private addTable(
    doc: typeof PDFDocument,
    data: any[],
    columns: Array<{ key: string; label: string; width: number }>,
  ) {
    const startX = 50;
    let startY = doc.y;

    // Table header
    doc.font('Helvetica-Bold').fontSize(10);
    let currentX = startX;

    columns.forEach((col) => {
      doc.text(col.label, currentX, startY, { width: col.width });
      currentX += col.width;
    });

    startY += 20;
    doc.moveTo(startX, startY).lineTo(currentX, startY).stroke();
    startY += 5;

    // Table rows
    doc.font('Helvetica').fontSize(9);

    data.forEach((row) => {
      if (startY > 700) {
        doc.addPage();
        startY = 50;
      }

      currentX = startX;
      columns.forEach((col) => {
        let value = row[col.key];
        if (value instanceof Date) {
          value = value.toLocaleDateString();
        }
        doc.text(String(value || ''), currentX, startY, { 
          width: col.width, 
          ellipsis: true 
        });
        currentX += col.width;
      });

      startY += 20;
    });

    doc.moveDown();
  }

  private addFooter(doc: typeof PDFDocument) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc.fontSize(8).fillColor('#666');
      doc.text(
        `Page ${i + 1} of ${pages.count}`,
        0,
        doc.page.height - oldBottomMargin / 2,
        { align: 'center' },
      );

      doc.page.margins.bottom = oldBottomMargin;
    }
  }

  async cleanupOldReports(daysToKeep: number = 30): Promise<void> {
    this.logger.log(`Cleaning up reports older than ${daysToKeep} days`);

    const files = fs.readdirSync(this.outputDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted old report: ${file}`);
      }
    });
  }
}
