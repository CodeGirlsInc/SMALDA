import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/documents')
@UseGuards(JwtAuthGuard)
export class ExcelExportController {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  @Get('export/excel')
  async exportExcel(@Req() req: { user: User }, @Res() res: Response) {
    const documents = await this.docs.find({ where: { ownerId: req.user.id }, order: { createdAt: 'DESC' } });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Documents');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Risk Score', key: 'riskScore', width: 12 },
      { header: 'Risk Flags', key: 'riskFlags', width: 40 },
      { header: 'Upload Date', key: 'createdAt', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const doc of documents) {
      sheet.addRow({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        riskScore: doc.riskScore ?? '',
        riskFlags: (doc.riskFlags ?? []).join(', '),
        createdAt: doc.createdAt.toISOString(),
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=documents.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  }
}