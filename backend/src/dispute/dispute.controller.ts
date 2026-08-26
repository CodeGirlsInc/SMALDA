import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
    const dispute = await this.disputeService.findOne(id);
    const user = req.user!;

    if (dispute.filedBy !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    return dispute;
  }
}
