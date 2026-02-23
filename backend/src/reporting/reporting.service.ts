import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { RiskIndicator } from '../risk/entities/risk-indicator.entity';
import { LandRecord } from '../land/entities/land-record.entity';
import { Workflow } from '../workflow/entities/workflow.entity';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,

    @InjectRepository(RiskIndicator)
    private readonly riskRepo: Repository<RiskIndicator>,

    @InjectRepository(LandRecord)
    private readonly landRepo: Repository<LandRecord>,

    @InjectRepository(Workflow)
    private readonly workflowRepo: Repository<Workflow>,
  ) {}

  /* -------------------------------------------------------------------------- */
  /* 1️⃣ Document Summary                                                        */
  /* -------------------------------------------------------------------------- */

  async getDocumentSummary(from: Date, to: Date) {
    const qb = this.documentRepo
      .createQueryBuilder('d')
      .select('COUNT(*)', 'totalUploaded')
      .addSelect(
        `COUNT(*) FILTER (WHERE d.status = 'VERIFIED')`,
        'verified',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE d.status = 'FAILED')`,
        'failed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE d.status = 'PENDING')`,
        'pending',
      )
      .where('d.createdAt BETWEEN :from AND :to', { from, to });

    const result = await qb.getRawOne();

    return {
      from,
      to,
      totalUploaded: Number(result.totalUploaded),
      verified: Number(result.verified),
      failed: Number(result.failed),
      pending: Number(result.pending),
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 2️⃣ Risk Distribution                                                       */
  /* -------------------------------------------------------------------------- */

  async getRiskDistribution() {
    const byType = await this.riskRepo
      .createQueryBuilder('r')
      .select('r.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.type')
      .getRawMany();

    const bySeverity = await this.riskRepo
      .createQueryBuilder('r')
      .select('r.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.severity')
      .getRawMany();

    const total = await this.riskRepo.count();

    return {
      total,
      byType: byType.reduce((acc, row) => {
        acc[row.type] = Number(row.count);
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc, row) => {
        acc[row.severity] = Number(row.count);
        return acc;
      }, {}),
    };
  }

  /* -------------------------------------------------------------------------- */
  /* 3️⃣ Verification Trend                                                      */
  /* -------------------------------------------------------------------------- */

  async getVerificationTrend(months: number) {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1),
      1,
    );

    const raw = await this.documentRepo
      .createQueryBuilder('d')
      .select('EXTRACT(MONTH FROM d.verifiedAt)', 'month')
      .addSelect('EXTRACT(YEAR FROM d.verifiedAt)', 'year')
      .addSelect('COUNT(*)', 'count')
      .where('d.status = :status', { status: 'VERIFIED' })
      .andWhere('d.verifiedAt >= :startDate', { startDate })
      .groupBy('year')
      .addGroupBy('month')
      .orderBy('year', 'ASC')
      .addOrderBy('month', 'ASC')
      .getRawMany();

    const map = new Map<string, number>();
    raw.forEach((row) => {
      const key = `${row.year}-${row.month}`;
      map.set(key, Number(row.count));
    });

    const result = [];

    for (let i = 0; i < months; i++) {
      const date = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + i,
        1,
      );
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      result.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        count: map.get(key) ?? 0,
      });
    }

    return result;
  }

  /* -------------------------------------------------------------------------- */
  /* 4️⃣ Top Risky Documents                                                     */
  /* -------------------------------------------------------------------------- */

  async getTopRiskyDocuments(limit: number) {
    const raw = await this.riskRepo
      .createQueryBuilder('r')
      .select('r.documentId', 'documentId')
      .addSelect('COUNT(*)', 'criticalIndicators')
      .where('r.severity = :severity', { severity: 'CRITICAL' })
      .andWhere('r.resolved = false')
      .groupBy('r.documentId')
      .orderBy('criticalIndicators', 'DESC')
      .limit(limit)
      .getRawMany();

    return raw.map((row) => ({
      documentId: row.documentId,
      criticalIndicators: Number(row.criticalIndicators),
    }));
  }

  /* -------------------------------------------------------------------------- */
  /* 5️⃣ System Health                                                           */
  /* -------------------------------------------------------------------------- */

  async getSystemHealth() {
    const [
      totalLandRecords,
      totalDocuments,
      unresolvedRiskIndicators,
      pendingWorkflows,
    ] = await Promise.all([
      this.landRepo.count(),
      this.documentRepo.count(),
      this.riskRepo.count({ where: { resolved: false } }),
      this.workflowRepo.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      totalLandRecords,
      totalDocuments,
      unresolvedRiskIndicators,
      pendingWorkflows,
    };
  }
}