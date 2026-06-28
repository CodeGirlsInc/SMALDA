import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateDisputeDto,
    @Req() req: Request & { user?: User },
  ) {
    const user = req.user!;
    return this.disputeService.create(user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string) {
    const dispute = await this.disputeService.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  @Get('document/:documentId')
  @UseGuards(JwtAuthGuard)
  async getByDocument(@Param('documentId') documentId: string) {
    return this.disputeService.findByDocument(documentId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyDisputes(@Req() req: Request & { user?: User }) {
    const user = req.user!;
    return this.disputeService.findByUser(user.id);
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @Req() req: Request & { user?: User },
  ) {
    const user = req.user!;
    return this.disputeService.resolve(id, dto, user.id);
  }
}
