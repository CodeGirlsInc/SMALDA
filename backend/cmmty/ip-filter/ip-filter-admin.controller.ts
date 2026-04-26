import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IpFilterService } from './ip-filter.service';
import { CreateIpRuleDto } from './dto/create-ip-rule.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { Roles } from '../../src/auth/guards/roles.decorator';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

@Controller('admin/ip-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class IpFilterAdminController {
  constructor(private readonly ipFilterService: IpFilterService) {}

  @Post()
  createIpRule(@Body() dto: CreateIpRuleDto) {
    return this.ipFilterService.createIpRule(dto);
  }

  @Delete(':id')
  deleteIpRule(@Param('id') id: string) {
    return this.ipFilterService.deleteIpRule(id);
  }

  @Get()
  getAllIpRules() {
    return this.ipFilterService.getAllIpRules();
  }
}
