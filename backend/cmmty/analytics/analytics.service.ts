import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { DocumentStatus } from '../../src/documents/entities/document.entity';

export interface TimeSeriesData {
  date: string;
  count: number;
}

export interface AnalyticsData {
  uploads: TimeSeriesData[];
  verifications: TimeSeriesData[];
  newUsers: TimeSeriesData[];
  averageRiskScore: number;
  topRiskFlags: Array<{ flag: string; count: number }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getAnalytics(period: '7d' | '30d' | '90d'): Promise<AnalyticsData> {
    const { startDate, endDate } = this.getDateRange(period);

    const [uploads, verifications, newUsers, riskData] = await Promise.all([
      this.getUploadsByDay(startDate, endDate),
      this.getVerificationsByDay(startDate, endDate),
      this.getNewUsersByDay(startDate, endDate),
      this.getRiskAnalytics(startDate, endDate),
    ]);

    return {
      uploads,
      verifications,
      newUsers,
      averageRiskScore: riskData.averageRiskScore,
      topRiskFlags: riskData.topRiskFlags,
    };
  }

  private getDateRange(period: '7d' | '30d' | '90d'): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  private async getUploadsByDay(startDate: Date, endDate: Date): Promise<TimeSeriesData[]> {
    const result = await this.documentRepository
      .createQueryBuilder('document')
      .select([
        'DATE(document.createdAt) as date',
        'COUNT(*) as count'
      ])
      .where('document.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(document.createdAt)')
      .orderBy('DATE(document.createdAt)', 'ASC')
      .getRawMany();

    return this.fillMissingDates(result, startDate, endDate);
  }

  private async getVerificationsByDay(startDate: Date, endDate: Date): Promise<TimeSeriesData[]> {
    const result = await this.documentRepository
      .createQueryBuilder('document')
      .select([
        'DATE(document.updatedAt) as date',
        'COUNT(*) as count'
      ])
      .where('document.status IN (:...statuses)', {
        statuses: [DocumentStatus.VERIFIED, DocumentStatus.FLAGGED],
      })
      .andWhere('document.updatedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(document.updatedAt)')
      .orderBy('DATE(document.updatedAt)', 'ASC')
      .getRawMany();

    return this.fillMissingDates(result, startDate, endDate);
  }

  private async getNewUsersByDay(startDate: Date, endDate: Date): Promise<TimeSeriesData[]> {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select([
        'DATE(user.createdAt) as date',
        'COUNT(*) as count'
      ])
      .where('user.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(user.createdAt)')
      .orderBy('DATE(user.createdAt)', 'ASC')
      .getRawMany();

    return this.fillMissingDates(result, startDate, endDate);
  }

  private async getRiskAnalytics(startDate: Date, endDate: Date): Promise<{
    averageRiskScore: number;
    topRiskFlags: Array<{ flag: string; count: number }>;
  }> {
    const documents = await this.documentRepository
      .createQueryBuilder('document')
      .where('document.riskScore IS NOT NULL')
      .andWhere('document.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getMany();

    if (documents.length === 0) {
      return {
        averageRiskScore: 0,
        topRiskFlags: [],
      };
    }

    const totalRiskScore = documents.reduce((sum, doc) => sum + (doc.riskScore || 0), 0);
    const averageRiskScore = totalRiskScore / documents.length;

    const flagCounts = new Map<string, number>();
    documents.forEach(doc => {
      if (doc.riskFlags) {
        doc.riskFlags.forEach(flag => {
          flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
        });
      }
    });

    const topRiskFlags = Array.from(flagCounts.entries())
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      topRiskFlags,
    };
  }

  private fillMissingDates(
    data: Array<{ date: string; count: string | number }>,
    startDate: Date,
    endDate: Date,
  ): TimeSeriesData[] {
    const dateMap = new Map<string, number>();
    data.forEach(item => {
      dateMap.set(item.date, typeof item.count === 'string' ? parseInt(item.count, 10) : item.count);
    });

    const result: TimeSeriesData[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }
}
