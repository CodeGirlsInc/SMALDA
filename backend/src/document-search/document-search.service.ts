import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandRecord } from '../land-record/entities/land-record.entity';
import { RiskIndicatorSeverity } from '../risk-indicator/enums/risk-indicator.enum';
import { SearchQueryDto } from './dto/search-query.dto';
import { RiskLevel } from './enums/risk-level.enum';
import { SearchResult } from './interfaces/search-result.interface';

// Maps each risk level to the set of severities that qualify a land record at
// that level (highest unresolved indicator wins). Assumes risk_indicators rows
// reference the land record UUID via their documentId column.
const RISK_SEVERITY_MAP: Record<Exclude<RiskLevel, 'NONE'>, RiskIndicatorSeverity[]> = {
  [RiskLevel.LOW]: [
    RiskIndicatorSeverity.LOW,
    RiskIndicatorSeverity.MEDIUM,
    RiskIndicatorSeverity.HIGH,
    RiskIndicatorSeverity.CRITICAL,
  ],
  [RiskLevel.MEDIUM]: [
    RiskIndicatorSeverity.MEDIUM,
    RiskIndicatorSeverity.HIGH,
    RiskIndicatorSeverity.CRITICAL,
  ],
  [RiskLevel.HIGH]: [RiskIndicatorSeverity.HIGH, RiskIndicatorSeverity.CRITICAL],
  [RiskLevel.CRITICAL]: [RiskIndicatorSeverity.CRITICAL],
};

@Injectable()
export class DocumentSearchService {
  constructor(
    @InjectRepository(LandRecord)
    private readonly landRecordRepository: Repository<LandRecord>,
  ) {}

  async search(query: SearchQueryDto): Promise<SearchResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.landRecordRepository
      .createQueryBuilder('lr')
      .where('lr.deletedAt IS NULL');

    if (query.keyword) {
      qb.andWhere(
        '(lr.parcelId ILIKE :kw OR lr.ownerName ILIKE :kw OR lr.location ILIKE :kw)',
        { kw: `%${query.keyword}%` },
      );
    }

    if (query.status) {
      qb.andWhere('lr.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('lr.registrationDate >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('lr.registrationDate <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.riskLevel === RiskLevel.NONE) {
      // Records that have no unresolved indicators at all
      qb.andWhere(
        `lr.id NOT IN (
          SELECT ri."documentId" FROM risk_indicators ri
          WHERE ri."isResolved" = false
        )`,
      );
    } else if (query.riskLevel) {
      const severities = RISK_SEVERITY_MAP[query.riskLevel];
      qb.andWhere(
        `lr.id IN (
          SELECT ri."documentId" FROM risk_indicators ri
          WHERE ri."isResolved" = false
            AND ri.severity IN (:...riskSeverities)
        )`,
        { riskSeverities: severities },
      );
    }

    const [data, total] = await qb
      .orderBy('lr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
