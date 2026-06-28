import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as QRCode from 'qrcode';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get(':id/qr-code')
  @UseGuards(JwtAuthGuard)
  async generateQrCode(@Param('id') id: string, @Res() res: Response) {
    const record = await this.verificationService.findOne(id);
    if (!record) {
      return res.status(404).json({ message: 'Verification record not found' });
    }

    const qrData = JSON.stringify({
      id: record.id,
      txHash: record.stellarTxHash,
      status: record.status,
    });

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="verification-${id}.png"`);
    res.send(qrBuffer);
  }
}
