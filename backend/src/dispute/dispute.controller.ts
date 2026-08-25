import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';
import { DisputeService } from './dispute.service';
import { DisputeStatus } from './entities/dispute.entity';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  async fileDispute(
    @Body() dto: CreateDisputeDto,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    return this.disputeService.fileDispute(dto, req.user!.id);
  }

  @Get()
  async getMyDisputes(
    @Req() req: Request & { user?: User },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: DisputeResponseDto[]; total: number }> {
    return this.disputeService.findByUser(
      req.user!.id,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':id')
  async getDispute(@Param('id') id: string): Promise<DisputeResponseDto> {
    return this.disputeService.findOne(id);
  }

  @Patch(':id/status')
  async updateDisputeStatus(
    @Param('id') id: string,
    @Body('status') status: DisputeStatus,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    return this.disputeService.updateStatus(id, status, req.user!.id);
  }
}
