import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListRiskAssessmentsDto } from './dto/list-risk-assessments.dto';
import { DocumentsService } from '../documents/documents.service';

@Controller('documents')
export class RiskAssessmentController {
  constructor(
    private readonly riskService: RiskAssessmentService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Get(':id/risk')
  @UseGuards(JwtAuthGuard)
  async getRisk(@Param('id') id: string) {
    return this.riskService.assessDocument(id);
  }

  @Get('risk-assessments')
  @UseGuards(JwtAuthGuard)
  async listRiskAssessments(@Query() query: ListRiskAssessmentsDto) {
    const { page = 1, limit = 20, minScore, maxScore, startDate, endDate, sortOrder = 'DESC' } = query;

    const result = await this.documentsService.findByRiskFilters({
      page,
      limit,
      minScore,
      maxScore,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortOrder,
    });

    return {
      data: result.data.map((doc) => ({
        documentId: doc.id,
        title: doc.title,
        riskScore: doc.riskScore,
        riskFlags: doc.riskFlags,
        status: doc.status,
        createdAt: doc.createdAt,
      })),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
