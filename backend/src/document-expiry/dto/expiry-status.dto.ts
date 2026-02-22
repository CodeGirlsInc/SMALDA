import { ApiProperty } from '@nestjs/swagger';
import { DocumentExpiry } from '../entities/document-expiry.entity';
import { ExpiryStatusLabel } from '../interfaces/expiry-status.interface';

export class ExpiryStatusDto {
  @ApiProperty({
    description: 'Full expiry record for the document',
    type: () => DocumentExpiry,
  })
  record: DocumentExpiry;

  @ApiProperty({
    description:
      'Days remaining until expiry. Positive means the document is still valid; ' +
      'negative means it has already expired by that many days.',
    example: 14,
  })
  daysUntilExpiry: number;

  @ApiProperty({
    description:
      'EXPIRED — past expiry date | ' +
      'EXPIRING_SOON — within the renewalPeriodDays alert window | ' +
      'VALID — comfortably within validity',
    enum: ['EXPIRED', 'EXPIRING_SOON', 'VALID'],
    example: 'EXPIRING_SOON',
  })
  status: ExpiryStatusLabel;
}
