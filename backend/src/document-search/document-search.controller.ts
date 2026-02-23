import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentSearchService } from './document-search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResult } from './interfaces/search-result.interface';

@ApiTags('Document Search')
@Controller('search')
export class DocumentSearchController {
  constructor(private readonly documentSearchService: DocumentSearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Full-text and filtered search across land records',
    description:
      'Supports partial keyword matching on parcelId, ownerName, and location ' +
      '(ILIKE), filtering by status, risk level, and registration date range. ' +
      'Returns a paginated response.',
  })
  @ApiResponse({ status: 200, description: 'Paginated search results' })
  search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    return this.documentSearchService.search(query);
  }
}
