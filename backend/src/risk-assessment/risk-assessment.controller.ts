import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

import { RiskAssessmentService } from './risk-assessment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
@UseInterceptors(CacheInterceptor)
export class RiskAssessmentController {
  constructor(private readonly riskService: RiskAssessmentService) {}

  @Get(':id/risk')
  @UseGuards(JwtAuthGuard)
  @CacheKey('document-risk')
  @CacheTTL(300_000) // 5 minutes in ms
  async getRisk(@Param('id') id: string) {
    return this.riskService.assessDocument(id);
  }
}
