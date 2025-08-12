import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { GlossaryBuilderService } from './glossary-builder.service';

@Controller('glossary')
export class GlossaryBuilderController {
  constructor(private readonly glossaryService: GlossaryBuilderService) {}

  @Post('build')
  async build(@Body('text') text: string) {
    return this.glossaryService.buildFromDocument(text);
  }

  @Get('search')
  async search(@Query('term') term: string) {
    return this.glossaryService.searchTerm(term);
  }
}
