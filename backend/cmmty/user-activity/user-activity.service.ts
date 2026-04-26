import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { UserActivity } from './user-activity.entity';

export interface PaginatedActivityResponse {
  data: UserActivity[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivity)
    private readonly userActivityRepository: Repository<UserActivity>,
  ) {}

  async getMyActivity(userId: string, dto: ActivityQueryDto): Promise<PaginatedActivityResponse> {
    const { page = 1, limit = 10, action } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, string> = { userId };
    if (action) {
      where.action = action;
    }

    const [data, total] = await this.userActivityRepository.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async logActivity(
    userId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<UserActivity> {
    const activity = this.userActivityRepository.create({ userId, action, metadata });
    return this.userActivityRepository.save(activity);
  }
}
