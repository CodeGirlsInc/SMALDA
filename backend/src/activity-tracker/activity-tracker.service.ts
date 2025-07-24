import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Activity } from "./entities/activity.entity"
import type { CreateActivityDto } from "./dto/create-activity.dto"
import type { FilterActivityDto } from "./dto/filter-activity.dto"

@Injectable()
export class ActivityTrackerService {
  constructor(private activityRepository: Repository<Activity>) {}

  /**
   * Logs a new user activity.
   * @param createActivityDto The DTO containing activity data.
   * @returns The created activity entity.
   */
  async logActivity(createActivityDto: CreateActivityDto): Promise<Activity> {
    const activity = this.activityRepository.create(createActivityDto)
    return this.activityRepository.save(activity)
  }

  /**
   * Retrieves user activities with optional filtering, pagination, and sorting.
   * @param filterDto The DTO containing filter, pagination, and sort parameters.
   * @returns An object containing activity entries and total count.
   */
  async findActivities(filterDto: FilterActivityDto): Promise<{ data: Activity[]; total: number }> {
    const {
      userId,
      actionType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = "timestamp",
      sortOrder = "DESC",
    } = filterDto

    const queryBuilder = this.activityRepository.createQueryBuilder("activity")

    // Apply filters
    if (userId) {
      queryBuilder.andWhere("activity.userId = :userId", { userId })
    }
    if (actionType) {
      queryBuilder.andWhere("activity.actionType = :actionType", { actionType })
    }
    if (startDate) {
      queryBuilder.andWhere("activity.timestamp >= :startDate", { startDate: new Date(startDate) })
    }
    if (endDate) {
      queryBuilder.andWhere("activity.timestamp <= :endDate", { endDate: new Date(endDate) })
    }

    // Order by
    queryBuilder.orderBy(`activity.${sortBy}`, sortOrder)

    // Pagination
    queryBuilder.skip((page - 1) * limit).take(limit)

    const [data, total] = await queryBuilder.getManyAndCount()
    return { data, total }
  }

  /**
   * Retrieves activities for a specific user.
   * @param userId The UUID of the user.
   * @returns An array of activity entities for the specified user.
   */
  async findActivitiesByUserId(userId: string): Promise<Activity[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { timestamp: "DESC" },
    })
  }
}
