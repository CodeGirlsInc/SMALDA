import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document, DocumentStatus } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardStatsController {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  @Get('stats')
  async stats(@Req() req: { user: User }) {
    const all = await this.docs.find({ where: { ownerId: req.user.id }, order: { createdAt: 'DESC' } });
    const documentsByStatus = Object.fromEntries(
      Object.values(DocumentStatus).map((s) => [s, all.filter((d) => d.status === s).length]),
    );
    const assessed = all.filter((d) => d.riskScore != null);
    const averageRiskScore = assessed.length
      ? Math.round((assessed.reduce((sum, d) => sum + (d.riskScore ?? 0), 0) / assessed.length) * 100) / 100
      : null;
    return {
      totalDocuments: all.length,
      documentsByStatus,
      averageRiskScore,
      highRiskCount: assessed.filter((d) => (d.riskScore ?? 0) >= 70).length,
      recentDocuments: all.slice(0, 5),
    };
  }
}