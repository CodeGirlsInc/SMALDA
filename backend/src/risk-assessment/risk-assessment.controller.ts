import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class RiskAssessmentController {
  constructor(private readonly riskService: RiskAssessmentService) {}

  @Get(':id/risk')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get risk assessment for a document' })
  @ApiResponse({ status: 200, description: 'Risk score and flags' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getRisk(@Param('id') id: string) {
    return this.riskService.assessDocument(id);
  }
}
