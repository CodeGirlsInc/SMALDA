import { Injectable, Logger } from "@nestjs/common"
import { type Repository, Between, type FindOptionsWhere } from "typeorm"
import type { AccessLog } from "./entities/access-log.entity"
import type { CreateAccessLogDto } from "./dto/create-access-log.dto"
import type { FilterAccessLogsDto } from "./dto/filter-access-logs.dto"

export interface PaginatedAccessLogs {
  data: AccessLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

@Injectable()
export class AccessLogsService {
  private readonly logger = new Logger(AccessLogsService.name)

  constructor(private readonly accessLogRepository: Repository<AccessLog>) {}

  async create(createAccessLogDto: CreateAccessLogDto): Promise<AccessLog> {
    try {
      const accessLog = this.accessLogRepository.create(createAccessLogDto)
      return await this.accessLogRepository.save(accessLog)
    } catch (error) {
      this.logger.error("Failed to create access log", error.stack)
      throw error
    }
  }

  async findAll(filterDto: FilterAccessLogsDto): Promise<PaginatedAccessLogs> {
    const { page = 1, limit = 50, sortByDateDesc = true, ...filters } = filterDto

    const where: FindOptionsWhere<AccessLog> = {}

    // Apply filters
    if (filters.userId) {
      where.userId = filters.userId
    }

    if (filters.routePath) {
      where.routePath = filters.routePath
    }

    if (filters.httpMethod) {
      where.httpMethod = filters.httpMethod
    }

    if (filters.ipAddress) {
      where.ipAddress = filters.ipAddress
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? new Date(filters.startDate) : new Date("1970-01-01")
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date()
      where.createdAt = Between(startDate, endDate)
    }

    const [data, total] = await this.accessLogRepository.findAndCount({
      where,
      order: {
        createdAt: sortByDateDesc ? "DESC" : "ASC",
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findByUser(userId: string, limit = 100): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    })
  }

  async findByTimeRange(startDate: Date, endDate: Date): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: "DESC" },
    })
  }

  async getAccessLogStats(userId?: string): Promise<{
    totalRequests: number
    uniqueIPs: number
    topRoutes: { routePath: string; count: number }[]
  }> {
    const queryBuilder = this.accessLogRepository.createQueryBuilder("log")

    if (userId) {
      queryBuilder.where("log.userId = :userId", { userId })
    }

    const totalRequests = await queryBuilder.getCount()

    const uniqueIPsResult = await queryBuilder.select("COUNT(DISTINCT log.ipAddress)", "count").getRawOne()

    const topRoutesResult = await queryBuilder
      .select("log.routePath", "routePath")
      .addSelect("COUNT(*)", "count")
      .groupBy("log.routePath")
      .orderBy("count", "DESC")
      .limit(10)
      .getRawMany()

    return {
      totalRequests,
      uniqueIPs: Number.parseInt(uniqueIPsResult.count),
      topRoutes: topRoutesResult.map((route) => ({
        routePath: route.routePath,
        count: Number.parseInt(route.count),
      })),
    }
  }
}
