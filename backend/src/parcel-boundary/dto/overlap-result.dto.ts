import { ApiProperty } from '@nestjs/swagger';

export class OverlapResultDto {
  @ApiProperty({
    description: 'The parcel ID of the potentially overlapping boundary',
    example: 'PARCEL-002',
  })
  parcelId: string;

  @ApiProperty({
    description:
      'Number of coordinate points shared between this parcel and the queried parcel. ' +
      'Based on exact coordinate matching — a higher count indicates a stronger overlap signal.',
    example: 3,
  })
  sharedCoordinateCount: number;
}
