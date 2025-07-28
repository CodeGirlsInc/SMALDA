import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { CourtCase, CaseOutcome, CaseStatus } from './entities/court-case.entity';
import { CreateCourtCaseDto } from './dto/create-court-case.dto';
import { AnalysisQueryDto } from './dto/analysis-query.dto';
import {
  ComprehensiveStats,
  RegionStats,
  WinRateStats,
  TimeToResolutionStats,
} from './interfaces/statistics.interface';

@Injectable()
export class CourtCasesService {
  constructor(
    @InjectRepository(CourtCase)
    private readonly courtCaseRepository: Repository<CourtCase>,
  ) {}

  // Basic CRUD Operations
  async create(createCourtCaseDto: CreateCourtCaseDto): Promise<CourtCase> {
    const courtCase = this.courtCaseRepository.create(createCourtCaseDto);
    
    // Calculate days to resolution if resolved date is provided
    if (courtCase.resolvedDate && courtCase.filedDate) {
      const timeDiff = new Date(courtCase.resolvedDate).getTime() - new Date(courtCase.filedDate).getTime();
      courtCase.daysToResolution = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    return await this.courtCaseRepository.save(courtCase);
  }

  async findAll(query?: AnalysisQueryDto): Promise<CourtCase[]> {
    const queryBuilder = this.courtCaseRepository.createQueryBuilder('case');

    if (query?.regions?.length) {
      queryBuilder.andWhere('case.region IN (:...regions)', { regions: query.regions });
    }

    if (query?.caseTypes?.length) {
      queryBuilder.andWhere('case.caseType IN (:...caseTypes)', { caseTypes: query.caseTypes });
    }

    if (query?.statuses?.length) {
      queryBuilder.andWhere('case.status IN (:...statuses)', { statuses: query.statuses });
    }

    if (query?.startDate && query?.endDate) {
      queryBuilder.andWhere('case.filedDate BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    if (query?.court) {
      queryBuilder.andWhere('case.court = :court', { court: query.court });
    }

    return await queryBuilder.getMany();
  }

  async findOne(id: string): Promise<CourtCase> {
    const courtCase = await this.courtCaseRepository.findOne({ where: { id } });
    if (!courtCase) {
      throw new NotFoundException(`Court case with ID ${id} not found`);
    }
    return courtCase;
  }

  // Bulk import from JSON
  async importFromJson(cases: CreateCourtCaseDto[]): Promise<{ imported: number; errors: any[] }> {
    const errors = [];
    let imported = 0;

    for (const caseData of cases) {
      try {
        await this.create(caseData);
        imported++;
      } catch (error) {
        errors.push({
          case: caseData.caseNumber,
          error: error.message,
        });
      }
    }

    return { imported, errors };
  }

  // Statistical Analysis Methods

  async getComprehensiveStats(query?: AnalysisQueryDto): Promise<ComprehensiveStats> {
    const cases = await this.findAll(query);
    const resolvedCases = cases.filter(c => c.status === CaseStatus.RESOLVED);

    return {
      totalCases: cases.length,
      resolvedCases: resolvedCases.length,
      resolutionRate: cases.length > 0 ? (resolvedCases.length / cases.length) * 100 : 0,
      winRateStats: await this.getWinRateStats(query),
      timeToResolutionStats: await this.getTimeToResolutionStats(query),
      regionStats: await this.getRegionStats(query),
      caseTypeDistribution: this.getCaseTypeDistribution(cases),
      outcomeDistribution: this.getOutcomeDistribution(cases),
      monthlyTrends: await this.getMonthlyTrends(query),
    };
  }

  async getWinRateStats(query?: AnalysisQueryDto): Promise<WinRateStats> {
    const cases = await this.findAll(query);
    const resolvedCases = cases.filter(c => c.outcome !== CaseOutcome.PENDING);

    // Overall win rate
    const totalResolved = resolvedCases.length;
    const wonCases = resolvedCases.filter(c => c.outcome === CaseOutcome.WON).length;
    const overallWinRate = totalResolved > 0 ? (wonCases / totalResolved) * 100 : 0;

    // Win rate by region
    const regionGroups = this.groupBy(resolvedCases, 'region');
    const byRegion = Object.entries(regionGroups).map(([region, cases]) => {
      const regionWon = cases.filter(c => c.outcome === CaseOutcome.WON).length;
      return {
        region,
        totalCases: cases.length,
        wonCases: regionWon,
        winRate: cases.length > 0 ? (regionWon / cases.length) * 100 : 0,
      };
    });

    // Win rate by case type
    const caseTypeGroups = this.groupBy(resolvedCases, 'caseType');
    const byCaseType = Object.entries(caseTypeGroups).map(([caseType, cases]) => {
      const typeWon = cases.filter(c => c.outcome === CaseOutcome.WON).length;
      return {
        caseType,
        totalCases: cases.length,
        wonCases: typeWon,
        winRate: cases.length > 0 ? (typeWon / cases.length) * 100 : 0,
      };
    });

    return {
      overall: {
        totalCases: totalResolved,
        wonCases,
        winRate: overallWinRate,
      },
      byRegion,
      byCaseType,
    };
  }

  async getTimeToResolutionStats(query?: AnalysisQueryDto): Promise<TimeToResolutionStats> {
    const cases = await this.findAll(query);
    const resolvedCases = cases.filter(c => c.daysToResolution !== null && c.daysToResolution !== undefined);

    if (resolvedCases.length === 0) {
      return {
        overall: { average: 0, median: 0, min: 0, max: 0 },
        byRegion: [],
        byCaseType: [],
      };
    }

    const resolutionTimes = resolvedCases.map(c => c.daysToResolution).sort((a, b) => a - b);

    // Overall stats
    const overall = {
      average: this.calculateAverage(resolutionTimes),
      median: this.calculateMedian(resolutionTimes),
      min: Math.min(...resolutionTimes),
      max: Math.max(...resolutionTimes),
    };

    // By region
    const regionGroups = this.groupBy(resolvedCases, 'region');
    const byRegion = Object.entries(regionGroups).map(([region, cases]) => {
      const times = cases.map(c => c.daysToResolution).sort((a, b) => a - b);
      return {
        region,
        average: this.calculateAverage(times),
        median: this.calculateMedian(times),
      };
    });

    // By case type
    const caseTypeGroups = this.groupBy(resolvedCases, 'caseType');
    const byCaseType = Object.entries(caseTypeGroups).map(([caseType, cases]) => {
      const times = cases.map(c => c.daysToResolution).sort((a, b) => a - b);
      return {
        caseType,
        average: this.calculateAverage(times),
        median: this.calculateMedian(times),
      };
    });

    return {
      overall,
      byRegion,
      byCaseType,
    };
  }

  async getRegionStats(query?: AnalysisQueryDto): Promise<RegionStats[]> {
    const cases = await this.findAll(query);
    const regionGroups = this.groupBy(cases, 'region');

    return Object.entries(regionGroups).map(([region, regionCases]) => {
      const resolvedCases = regionCases.filter(c => c.outcome !== CaseOutcome.PENDING);
      const wonCases = resolvedCases.filter(c => c.outcome === CaseOutcome.WON);
      const lostCases = resolvedCases.filter(c => c.outcome === CaseOutcome.LOST);
      const settledCases = resolvedCases.filter(c => c.outcome === CaseOutcome.SETTLED);

      const casesWithResolutionTime = regionCases.filter(c => c.daysToResolution !== null);
      const avgTimeToResolution = casesWithResolutionTime.length > 0
        ? this.calculateAverage(casesWithResolutionTime.map(c => c.daysToResolution))
        : 0;

      const casesWithClaimAmount = regionCases.filter(c => c.claimAmount !== null);
      const avgClaimAmount = casesWithClaimAmount.length > 0
        ? this.calculateAverage(casesWithClaimAmount.map(c => Number(c.claimAmount)))
        : 0;

      const casesWithSettlementAmount = regionCases.filter(c => c.settlementAmount !== null);
      const avgSettlementAmount = casesWithSettlementAmount.length > 0
        ? this.calculateAverage(casesWithSettlementAmount.map(c => Number(c.settlementAmount)))
        : 0;

      return {
        region,
        totalCases: regionCases.length,
        wonCases: wonCases.length,
        lostCases: lostCases.length,
        settledCases: settledCases.length,
        winRate: resolvedCases.length > 0 ? (wonCases.length / resolvedCases.length) * 100 : 0,
        avgTimeToResolution,
        avgClaimAmount,
        avgSettlementAmount,
      };
    });
  }

  private getCaseTypeDistribution(cases: CourtCase[]) {
    const typeGroups = this.groupBy(cases, 'caseType');
    return Object.entries(typeGroups).map(([caseType, typeCases]) => ({
      caseType,
      count: typeCases.length,
      percentage: cases.length > 0 ? (typeCases.length / cases.length) * 100 : 0,
    }));
  }

  private getOutcomeDistribution(cases: CourtCase[]) {
    const outcomeGroups = this.groupBy(cases, 'outcome');
    return Object.entries(outcomeGroups).map(([outcome, outcomeCases]) => ({
      outcome,
      count: outcomeCases.length,
      percentage: cases.length > 0 ? (outcomeCases.length / cases.length) * 100 : 0,
    }));
  }

  private async getMonthlyTrends(query?: AnalysisQueryDto) {
    const cases = await this.findAll(query);
    
    // Group by month-year
    const monthlyGroups = cases.reduce((acc: Record<string, { filed: CourtCase[]; resolved: CourtCase[] }>, case_) => {
      const monthKey = new Date(case_.filedDate).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[monthKey]) {
        acc[monthKey] = { filed: [], resolved: [] };
      }
      acc[monthKey].filed.push(case_);
      
      if (case_.resolvedDate) {
        const resolvedMonthKey = new Date(case_.resolvedDate).toISOString().slice(0, 7);
        if (!acc[resolvedMonthKey]) {
          acc[resolvedMonthKey] = { filed: [], resolved: [] };
        }
        acc[resolvedMonthKey].resolved.push(case_);
      }
      
      return acc;
    }, {} as Record<string, { filed: CourtCase[]; resolved: CourtCase[] }>);

    return Object.entries(monthlyGroups).map(([month, data]) => {
      const resolvedWithTime = data.resolved.filter(c => c.daysToResolution !== null);
      const avgResolutionTime = resolvedWithTime.length > 0
        ? this.calculateAverage(resolvedWithTime.map(c => c.daysToResolution))
        : 0;

      return {
        month,
        casesFiledCount: data.filed.length,
        casesResolvedCount: data.resolved.length,
        avgResolutionTime,
      };
    }).sort((a, b) => a.month.localeCompare(b.month));
  }

  // Utility methods
  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const group = String(item[key]);
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return Math.round((numbers.reduce((sum, num) => sum + num, 0) / numbers.length) * 100) / 100;
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
  }
}
