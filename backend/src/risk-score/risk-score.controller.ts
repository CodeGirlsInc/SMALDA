import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RiskScoreService } from './risk-score.service';
import { RiskScoreResult } from './interfaces/risk-score-result.interface';

@ApiTags('Risk Scores')
@Controller('risk-scores')
export class RiskScoreController {
  constructor(private readonly riskScoreService: RiskScoreService) {}

  @Get(':documentId')
  @ApiOperation({
    summary: 'Compute the aggregate risk score for a document',
    description:
      'Reads all unresolved risk indicators for the document and returns a ' +
      'weighted score (0–100) along with a breakdown by severity.',
  })
  @ApiParam({ name: 'documentId', description: 'UUID of the document to score' })
  @ApiResponse({
    status: 200,
    description: 'Computed risk score and breakdown',
    schema: {
      example: {
        documentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        score: 52,
        riskLevel: 'HIGH',
        indicatorCount: 4,
        breakdown: { low: 1, medium: 1, high: 1, critical: 1 },
        computedAt: '2024-06-01T12:00:00.000Z',
      },
    },
  })
  computeScore(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<RiskScoreResult> {
    return this.riskScoreService.computeScore(documentId);
  }
}
