import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RiskAssessmentResponseDto } from './dto/risk-assessment-response.dto';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
@UseInterceptors(CacheInterceptor)
export class RiskAssessmentController {
  constructor(private readonly riskService: RiskAssessmentService) {}

  @Get(':id/risk')
  @UseGuards(JwtAuthGuard)
  @CacheKey('document-risk')
  @CacheTTL(300_000)
  @ApiResponse({ status: 200, type: RiskAssessmentResponseDto })
  async getRisk(@Param('id') id: string): Promise<RiskAssessmentResponseDto> {
    return this.riskService.assessDocument(id);
  }
}
