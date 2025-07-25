import { Controller, Get, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { TimelineGeneratorService } from './timeline-generator.service';

@Controller('timeline-generator')
export class TimelineGeneratorController {
  constructor(private readonly timelineGeneratorService: TimelineGeneratorService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getTimeline(@Query('caseId') caseId: string) {
    if (!caseId) throw new BadRequestException('caseId is required');
    return this.timelineGeneratorService.generateTimeline(caseId);
  }
} 