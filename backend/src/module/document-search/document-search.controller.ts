import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/documents')
@UseGuards(JwtAuthGuard)
export class DocumentSearchController {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  @Get('search')
  async search(
    @Req() req: { user: User },
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!q || !q.trim()) throw new BadRequestException('Search query q is required');
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, parseInt(limit, 10));
    const [data, total] = await this.docs.findAndCount({
      where: { ownerId: req.user.id, title: ILike(`%${q}%`) },
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
    return { data, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }
}