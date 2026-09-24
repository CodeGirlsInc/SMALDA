import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListRiskAssessmentsDto } from './dto/list-risk-assessments.dto';
import { DocumentsService } from '../documents/documents.service';

@ApiTags('documents')
@Controller('documents')
export class RiskAssessmentController {
  constructor(
    private readonly riskService: RiskAssessmentService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Get(':id/risk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assess the risk score of a document' })
  async getRisk(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.riskService.assessDocument(id, lang);
  }

  @Get('risk-assessments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List documents by risk filters (paginated)' })
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
