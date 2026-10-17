import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListRiskAssessmentsDto } from './dto/list-risk-assessments.dto';
import { DocumentsService } from '../documents/documents.service';
import { Document } from '../documents/entities/document.entity';
import { User, UserRole } from '../users/entities/user.entity';

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
  @ApiOperation({ summary: 'Get the stored risk assessment of a document' })
  async getRisk(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
    @Query('lang') lang?: string,
  ) {
    await this.getAccessibleDocument(id, req.user);
    // Reads must not mutate data; scoring happens in the queue job.
    return this.riskService.getStoredAssessment(id, lang);
  }

  @Post(':id/risk/reassess')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Explicitly recompute the risk score of a document' })
  async reassessRisk(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user?: User },
    @Query('lang') lang?: string,
  ) {
    await this.getAccessibleDocument(id, req.user);
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

  private async getAccessibleDocument(
    id: string,
    user?: User,
  ): Promise<Document> {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!user || (document.ownerId !== user.id && user.role !== UserRole.ADMIN)) {
      throw new ForbiddenException('Access denied');
    }

    return document;
  }
}
