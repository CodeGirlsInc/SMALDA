import { Controller, Get, Param, Req, Res, UseGuards, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as PDFDocument from 'pdfkit';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/documents')
@UseGuards(JwtAuthGuard)
export class PDFExportController {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  @Get(':id/export/pdf')
  async exportPdf(@Param('id') id: string, @Req() req: { user: User }, @Res() res: Response) {
    const doc = await this.docs.findOneBy({ id });
    if (!doc) throw new NotFoundException();
    if (doc.ownerId !== req.user.id) throw new ForbiddenException();
    if (doc.riskScore == null) throw new UnprocessableEntityException('Document has not been risk-assessed');
    const riskLevel = doc.riskScore < 30 ? 'LOW' : doc.riskScore < 70 ? 'MEDIUM' : 'HIGH';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
    const pdf = new PDFDocument();
    pdf.pipe(res);
    pdf.fontSize(18).text(doc.title, { underline: true });
    pdf.moveDown().fontSize(12)
      .text(`Upload Date: ${doc.createdAt.toISOString()}`)
      .text(`Status: ${doc.status}`)
      .text(`Risk Score: ${doc.riskScore} (${riskLevel})`);
    if (doc.riskFlags?.length) {
      pdf.moveDown().text('Risk Flags:');
      doc.riskFlags.forEach((f) => pdf.text(`  - ${f}`));
    }
    pdf.end();
  }
}