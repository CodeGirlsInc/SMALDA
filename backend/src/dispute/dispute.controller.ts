import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { DocumentsService } from '../documents/documents.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResponseDto } from './dto/dispute-response.dto';
import { ListDisputesDto } from './dto/list-disputes.dto';
import { PaginateDisputesDto } from './dto/paginate-disputes.dto';
import { ReassignDisputeDto } from './dto/reassign-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { DisputeStatus } from './entities/dispute.entity';
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

    if (document.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You can only file disputes on your own documents',
      );
    }

    return this.disputeService.fileDispute(dto, user.id);
  }

  @Get()
  async getMyDisputes(
    @Req() req: Request & { user?: User },
    @Query() query: PaginateDisputesDto,
  ): Promise<{
    data: DisputeResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = query;
    const result = await this.disputeService.findByUser(
      req.user!.id,
      page,
      limit,
    );

    return {
      ...result,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  @Get(':id')
  async getDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    const user = req.user!;
    const dispute = await this.disputeService.findOne(
      id,
      user.id,
      user.role === UserRole.ADMIN,
    );

    if (dispute.filedBy !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    return dispute;
  }

  @Patch(':id/status')
  async updateDisputeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    const user = req.user!;
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only administrators can update a dispute status',
      );
    }

    return this.disputeService.updateStatus(
      id,
      dto.status,
      user.id,
      dto.resolution,
      dto.resolutionNote,
    );
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only administrators can resolve a dispute',
      );
    }

    return this.disputeService.updateStatus(
      id,
      DisputeStatus.RESOLVED,
      req.user!.id,
      dto.resolution,
      dto.resolutionNote,
    );
  }

  @Delete(':id')
  async withdrawDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    return this.disputeService.withdraw(id, req.user!.id);
  }

  @Post(':id/reassign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reassignDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignDisputeDto,
    @Req() req: Request & { user?: User },
  ): Promise<DisputeResponseDto> {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only administrators can reassign a dispute',
      );
    }

    return this.disputeService.reassign(id, dto, req.user!.id);
  }
}

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Get()
  async listDisputes(
    @Query() query: ListDisputesDto,
    @Req() req?: Request & { user?: User },
  ): Promise<{
    data: DisputeResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (req?.user && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can list disputes');
    }

    const { page = 1, limit = 20, status } = query;
    const result = await this.disputeService.findAll(page, limit, status);

    return {
      ...result,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
