import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getLogs(
    @Req() req: Request & { user?: User },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return this.auditService.findAll(Math.max(1, +page), Math.min(100, +limit));
  }
}
