import {
  Body,
  Controller,
  ForbiddenException,
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
import { DocumentsService } from '../documents/documents.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { DisputeService } from './dispute.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(
    private readonly disputeService: DisputeService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post()
  async fileDispute(
    @Body() dto: CreateDisputeDto,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    const user = req.user!;
    const document = await this.documentsService.findById(dto.documentId);

    if (!document) {
      throw new ForbiddenException('Document not found');
    }

    if (document.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException(
        'You can only file disputes on your own documents',
      );
    }

    return this.disputeService.fileDispute(dto, user.id);
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
  async getDispute(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    const user = req.user!;
    const dispute = await this.disputeService.findOne(
      id,
      user.id,
      user.role === 'admin',
    );

    if (dispute.filedBy !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    return dispute;
  }

  @Patch(':id/status')
  async updateDisputeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    const user = req.user!;
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Only administrators can update a dispute status',
      );
    }

    return this.disputeService.updateStatus(id, dto.status, user.id);
  }
}
