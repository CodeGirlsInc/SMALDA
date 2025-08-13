import { Body, Controller, Post } from '@nestjs/common';
import { RiskService } from './risk.service';
import { EvaluateRiskDto } from './dto/evaluate-risk.dto';
import { RiskResponseDto } from './dto/risk-response.dto';

@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post('evaluate')
  evaluate(@Body() body: EvaluateRiskDto): RiskResponseDto {
    return this.riskService.evaluate(body);
  }
}
