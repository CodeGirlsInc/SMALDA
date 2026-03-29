import { ApiProperty } from '@nestjs/swagger';
import { RiskFlag } from '../risk-assessment.service';

export class RiskAssessmentResponseDto {
  @ApiProperty()
  documentId: string;

  @ApiProperty()
  riskScore: number;

  @ApiProperty({ enum: RiskFlag, isArray: true })
  riskFlags: RiskFlag[];

  @ApiProperty()
  assessedAt: Date;
}
