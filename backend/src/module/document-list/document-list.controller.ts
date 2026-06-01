import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document, DocumentStatus } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/documents')
@UseGuards(JwtAuthGuard)
export class DocumentListController {
  constructor(
    @InjectRepository(Document)
    private readonly docs: Repository<Document>,
  ) {}

  @Get()
  async list(
    @Req() req: { user: User },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: DocumentStatus,
  ) {
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const where: Record<string, unknown> = { ownerId: req.user.id };
    if (status) where['status'] = status;
    const [data, total] = await this.docs.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
    return { data, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }
}