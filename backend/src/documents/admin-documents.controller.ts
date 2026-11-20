import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DocumentsService } from './documents.service';
import { AdminDocumentsQueryDto } from './dto/document-filters.dto';

/** `GET /admin/documents`: every user's documents, filterable and paginated. */
@Controller('admin/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list(@Query() query: AdminDocumentsQueryDto) {
    const { page = 1, limit = 20, ...filters } = query;
    const { data, total } = await this.documentsService.findFiltered(filters, {
      page,
      limit,
    });
    return {
      data: data.map((d) => ({
        id: d.id,
        ownerId: d.ownerId,
        title: d.title,
        status: d.status,
        riskScore: d.riskScore ?? null,
        riskFlags: d.riskFlags ?? null,
        fileSize: d.fileSize,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
