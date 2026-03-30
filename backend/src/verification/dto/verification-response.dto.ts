import { ApiProperty } from '@nestjs/swagger';
import { VerificationStatus } from '../entities/verification-record.entity';

export class VerificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  documentId: string;

  @ApiProperty()
  stellarTxHash: string;

  @ApiProperty()
  stellarLedger: number;

  @ApiProperty({ nullable: true })
  anchoredAt?: Date;

  @ApiProperty({ enum: VerificationStatus })
  status: VerificationStatus;
}
