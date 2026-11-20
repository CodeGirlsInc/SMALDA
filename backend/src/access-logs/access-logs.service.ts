import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AccessLog } from './entities/access-log.entity';
import type { CreateAccessLogDto } from './dto/create-access-log.dto';
import type { FilterAccessLogsDto } from './dto/filter-access-logs.dto';

export interface PaginatedAccessLogs {
  data: AccessLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AccessLogsService {
  private readonly logger = new Logger(AccessLogsService.name);

  constructor(
    @InjectRepository(AccessLog)
    private readonly accessLogRepository: Repository<AccessLog>,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async create(dto: CreateAccessLogDto): Promise<AccessLog> {
    const log = this.accessLogRepository.create({
      userId: dto.userId ?? null,
      routePath: dto.routePath,
      httpMethod: dto.httpMethod,
      ipAddress: dto.ipAddress,
      statusCode: dto.statusCode ?? null,
      ...(dto.action != null ? { action: dto.action } : {}),
      ...(dto.resourceType != null ? { resourceType: dto.resourceType } : {}),
      ...(dto.resourceId != null ? { resourceId: dto.resourceId } : {}),
      ...(dto.metadata != null ? { metadata: dto.metadata } : {}),
      ...(dto.userAgent != null ? { userAgent: dto.userAgent } : {}),
    });
    return this.accessLogRepository.save(log);
  }

  async logDocumentAccess(
    documentId: string,
    action: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    isDenied = false,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.create({
        userId: userId ?? null,
        routePath: `documents/${documentId}/${action}`,
        httpMethod: this.httpMethodForAction(action),
        ipAddress: ipAddress ?? '',
        userAgent: userAgent ?? null,
        statusCode: isDenied ? 403 : 200,
        action,
        resourceType: 'document',
        resourceId: documentId,
        metadata: metadata ?? null,
      });
      this.logger.log(
        `Document Access Log: docId=${documentId}, action=${action}, user=${userId || 'anonymous'}, denied=${isDenied}`,
      );
    } catch (err) {
      this.logger.error('Failed to log document access', err);
    }
  }

  private httpMethodForAction(action: string): string {
    if (action === 'dispute_filed') return 'POST';
    if (action === 'dispute_status_changed') return 'PATCH';
    return 'GET';
  }

  async findAll(filterDto: FilterAccessLogsDto): Promise<PaginatedAccessLogs> {
    const {
      page = 1,
      limit = 50,
      sortByDateDesc = true,
      ...filters
    } = filterDto;

    const where: FindOptionsWhere<AccessLog> = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.routePath) {
      where.routePath = filters.routePath;
    }

    if (filters.httpMethod) {
      where.httpMethod = filters.httpMethod;
    }

    if (filters.ipAddress) {
      where.ipAddress = filters.ipAddress;
    }

    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate
        ? new Date(filters.startDate)
        : new Date('1970-01-01');
      // A date-only `endDate` (2026-11-18) means the whole of that day, not its
      // midnight, otherwise a one-day range matches nothing (#1651).
      const endDate = filters.endDate
        ? /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)
          ? new Date(`${filters.endDate}T23:59:59.999Z`)
          : new Date(filters.endDate)
        : new Date();
      where.createdAt = Between(startDate, endDate);
    }

    const [data, total] = await this.accessLogRepository.findAndCount({
      where,
      order: {
        createdAt: sortByDateDesc ? 'DESC' : 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByUser(userId: string, limit = 100): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByTimeRange(startDate: Date, endDate: Date): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getAccessLogStats(userId?: string): Promise<{
    totalRequests: number;
    uniqueIPs: number;
    topRoutes: { routePath: string; count: number }[];
  }> {
    const queryBuilder = this.accessLogRepository.createQueryBuilder('log');

    if (userId) {
      queryBuilder.where('log.userId = :userId', { userId });
    }

    const totalRequests = await queryBuilder.getCount();

    const uniqueIPsResult = await queryBuilder
      .select('COUNT(DISTINCT log.ipAddress)', 'count')
      .getRawOne();

    const topRoutesResult = await queryBuilder
      .select('log.routePath', 'routePath')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.routePath')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalRequests,
      uniqueIPs: Number.parseInt(uniqueIPsResult.count),
      topRoutes: topRoutesResult.map((route) => ({
        routePath: route.routePath,
        count: Number.parseInt(route.count),
      })),
    };
  }

  async deleteOldLogs(olderThan: Date): Promise<void> {
    await this.accessLogRepository.delete({
      createdAt: Between(new Date('1970-01-01'), olderThan),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldLogs(): Promise<void> {
    const retentionDays =
      Number(this.configService?.get('ACCESS_LOG_RETENTION_DAYS')) || 90;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await this.deleteOldLogs(cutoff);
    this.logger.log(
      `Purged access logs older than ${cutoff.toISOString()} (retention: ${retentionDays} days)`,
    );
  }
}
