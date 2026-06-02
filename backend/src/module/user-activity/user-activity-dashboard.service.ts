import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Activity } from '../../activity-tracker/entities/activity.entity';

@Injectable()
export class UserActivityDashboardService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
  ) {}

  async findRecentActivity(
    userId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const query = this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.userId = :userId', { userId })
      .orderBy('activity.timestamp', 'DESC')
      .take(50);

    if (startDate) {
      query.andWhere('activity.timestamp >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      query.andWhere('activity.timestamp <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const activities = await query.getMany();

    return activities.map((activity) => ({
      id: activity.id,
      actionType: activity.actionType,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      metadata: activity.metadata ?? {},
      timestamp: activity.timestamp,
    }));
  }
}
