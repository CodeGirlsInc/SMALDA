import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogPaginationQueryDto } from './dto/audit-log-pagination-query.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('cmmty')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('admin/audit-logs')
  async getAllAuditLogs(
    @Req() req: AuthenticatedRequest,
    @Query() dto: AuditLogPaginationQueryDto,
  ) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new Error('Access denied: Admin role required');
    }
    return this.auditLogService.findAll(dto);
  }

  @Get('users/me/audit-logs')
  async getMyAuditLogs(
    @Req() req: AuthenticatedRequest,
    @Query() dto: AuditLogPaginationQueryDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.auditLogService.findByUserId(userId, dto);
  }
}