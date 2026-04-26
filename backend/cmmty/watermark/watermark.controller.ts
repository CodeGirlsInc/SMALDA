import { Controller, Get, Param, Res, UseGuards, Request, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { WatermarkService } from './watermark.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class WatermarkController {
  constructor(private readonly watermarkService: WatermarkService) {}

  @Get(':id/download')
  async downloadWatermarked(
    @Param('id') documentId: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, mimeType, filename } = await this.watermarkService.downloadWithWatermark(
      documentId,
      req.user.id,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }
}
