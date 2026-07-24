import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';
import { FilterAccessLogsDto } from './dto/filter-access-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('admin/access-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAccessLogs(@Query() filterDto: FilterAccessLogsDto) {
    return this.accessLogsService.findAll(filterDto);
  }
}
