// [BE-49] Add document statistics endpoint
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Document, DocumentStatus } from '../documents/entities/document.entity';

@Controller('documents/stats')
@UseGuards(JwtAuthGuard)
export class DocumentStatsController {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  @Get()
  async getOverallStats() {
    const total = await this.documentRepo.count();
    const byStatus = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('doc.status')
      .getRawMany();

    return { total, byStatus };
  }

  @Get('owner/:ownerId')
  async getStatsByOwner(@Param('ownerId') ownerId: string) {
    const total = await this.documentRepo.count({ where: { ownerId } });
    const verified = await this.documentRepo.count({
      where: { ownerId, status: DocumentStatus.VERIFIED },
    });
    const flagged = await this.documentRepo.count({
      where: { ownerId, status: DocumentStatus.FLAGGED },
    });
    const pending = await this.documentRepo.count({
      where: { ownerId, status: DocumentStatus.PENDING },
    });

    return { ownerId, total, verified, flagged, pending };
  }
}
