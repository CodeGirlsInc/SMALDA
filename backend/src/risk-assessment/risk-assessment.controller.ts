import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('documents')
export class RiskAssessmentController {
  constructor(private readonly riskService: RiskAssessmentService) {}

  @Get(':id/risk')
  @UseGuards(JwtAuthGuard)
  async getRisk(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.riskService.assessDocument(id, lang);
  }
}
