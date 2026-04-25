import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DocumentSearchService } from './document-search.service';
import { DocumentSearchQueryDto } from './dto/document-search-query.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

@Controller('documents/search')
@UseGuards(JwtAuthGuard)
export class DocumentSearchController {
  constructor(private readonly documentSearchService: DocumentSearchService) {}

  @Get()
  search(@Query() dto: DocumentSearchQueryDto) {
    return this.documentSearchService.search(dto);
  }
}