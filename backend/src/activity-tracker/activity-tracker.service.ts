import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Activity } from './entities/activity.entity';
import type { CreateActivityDto } from './dto/create-activity.dto';
import {
  ACTIVITY_SORT_COLUMNS,
  FilterActivityDto,
} from './dto/filter-activity.dto';

/** Activity older than this is deleted by the daily retention job. */
export const ACTIVITY_RETENTION_DAYS = 90;

/**
 * Truncate an IP before storing it: IPv4 keeps the first three octets, IPv6
 * the first three groups. Enough for coarse abuse analysis without keeping a
 * raw address.
 */
export function truncateIp(ip?: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    return v4.split('.').slice(0, 3).join('.') + '.0';
  }
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + '::';
  }
  return null;
}

@Injectable()
export class ActivityTrackerService {
  private readonly logger = new Logger(ActivityTrackerService.name);

  constructor(
    @InjectRepository(Activity)
    private activityRepository: Repository<Activity>,
  ) {}

  /**
   * Best-effort recording used by other modules (login, role change, ...).
   * Never throws: failing to record activity must not break the action.
   */
  async record(
    userId: string,
    actionType: string,
    options: { ip?: string | null; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    try {
      await this.logActivity({
        userId,
        actionType,
        ipAddress: truncateIp(options.ip),
        metadata: options.metadata ?? null,
      });
    } catch (error) {
      this.logger.warn(`Could not record ${actionType}: ${(error as Error)?.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 86_400_000);
    const result = await this.activityRepository.delete({
      timestamp: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }

  /**
   * Logs a new user activity.
   * @param createActivityDto The DTO containing activity data.
   * @returns The created activity entity.
   */
  async logActivity(createActivityDto: CreateActivityDto): Promise<Activity> {
    const activity = this.activityRepository.create(createActivityDto);
    return this.activityRepository.save(activity);
  }

  /**
   * Retrieves user activities with optional filtering, pagination, and sorting.
   * @param filterDto The DTO containing filter, pagination, and sort parameters.
   * @returns An object containing activity entries and total count.
   */
  async findActivities(
    filterDto: FilterActivityDto,
  ): Promise<{ data: Activity[]; total: number }> {
    const {
      userId,
      actionType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
    } = filterDto;

    const queryBuilder = this.activityRepository.createQueryBuilder('activity');

    // Apply filters
    if (userId) {
      queryBuilder.andWhere('activity.userId = :userId', { userId });
    }
    if (actionType) {
      queryBuilder.andWhere('activity.actionType = :actionType', {
        actionType,
      });
    }
    if (startDate) {
      queryBuilder.andWhere('activity.timestamp >= :startDate', {
        startDate: new Date(startDate),
      });
    }
    if (endDate) {
      queryBuilder.andWhere('activity.timestamp <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // Order by
    const column = (ACTIVITY_SORT_COLUMNS as readonly string[]).includes(sortBy)
      ? sortBy
      : 'timestamp';
    queryBuilder.orderBy(`activity.${column}`, sortOrder);

    // Pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  /**
   * Retrieves activities for a specific user.
   * @param userId The UUID of the user.
   * @returns An array of activity entities for the specified user.
   */
  async findActivitiesByUserId(userId: string): Promise<Activity[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }

  async findActivitiesByActionType(actionType: string): Promise<Activity[]> {
    return this.activityRepository.find({
      where: { actionType },
      order: { timestamp: 'DESC' },
    });
  }

  async findAll(action?: string): Promise<Activity[]> {
    return this.activityRepository.find({
      where: action ? { actionType: action } : {},
      order: { timestamp: 'DESC' },
    });
  }
}
