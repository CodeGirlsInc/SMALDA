import { Controller, Get, Post, Param, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsIn, IsUUID } from 'class-validator';

class ExportFormatDto {
  @IsUUID()
  id: string;

  @IsIn(['pdf', 'excel'])
  format: 'pdf' | 'excel';
}

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('documents/:id/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportService.exportToPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="document-${id}.pdf"`,
    });
    res.send(buffer);
  }

  @Get('documents/:id/excel')
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportService.exportToExcel(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="document-${id}.xlsx"`,
    });
    res.send(buffer);
  }

  @Post('documents/:id')
  async exportDocument(@Param('id') id: string, @Body() body: ExportFormatDto) {
    if (body.format === 'pdf') {
      return this.exportService.exportToPdf(id);
    }
    return this.exportService.exportToExcel(id);
  }
}
