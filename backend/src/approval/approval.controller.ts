import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { ApprovalService } from './approval.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';

@Controller('approval')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post()
  @Roles('admin', 'approver')
  create(@Body() dto: CreateApprovalDto) {
    return this.approvalService.create(dto);
  }

  @Get('verification/:verificationId')
  @Roles('admin', 'approver')
  findByVerification(@Param('verificationId') verificationId: string) {
    return this.approvalService.findByVerification(verificationId);
  }

  @Get('gate/:verificationId')
  checkGate(@Param('verificationId') verificationId: string) {
    return this.approvalService.checkGate(verificationId);
  }

  @Patch(':id')
  @Roles('admin', 'approver')
  update(@Param('id') id: string, @Body() dto: UpdateApprovalDto) {
    return this.approvalService.update(id, dto);
  }
}
