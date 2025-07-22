import { Controller, Get } from "@nestjs/common"
import type { AccessLogsService, PaginatedAccessLogs } from "./access-logs.service"
import type { FilterAccessLogsDto } from "./dto/filter-access-logs.dto"
import type { AccessLog } from "./entities/access-log.entity"

// Uncomment and modify based on your authentication setup
// @UseGuards(JwtAuthGuard)
@Controller("access-logs")
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  async findAll(filterDto: FilterAccessLogsDto): Promise<PaginatedAccessLogs> {
    return this.accessLogsService.findAll(filterDto)
  }

  @Get("stats")
  async getStats(userId?: string) {
    return this.accessLogsService.getAccessLogStats(userId)
  }

  @Get("by-user")
  async findByUser(userId: string, limit = 100): Promise<AccessLog[]> {
    return this.accessLogsService.findByUser(userId, limit)
  }
}
