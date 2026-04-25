import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import {
  CursorPaginationQueryDto,
  CursorPaginationHelper,
  CursorPaginatedResult,
} from './cursor-pagination';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsPaginationController {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  @Get()
  async findAll(@Query() dto: CursorPaginationQueryDto): Promise<CursorPaginatedResult<Document>> {
    const { cursor, limit = 10 } = dto;

    const queryBuilder = this.documentRepository.createQueryBuilder('document');

    CursorPaginationHelper.applyCursorPagination(queryBuilder, cursor, limit);

    const results = await queryBuilder.getMany();

    return CursorPaginationHelper.processResults(results, limit);
  }
}