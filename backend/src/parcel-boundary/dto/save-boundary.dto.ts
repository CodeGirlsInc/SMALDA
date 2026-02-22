import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class SaveBoundaryDto {
  @ApiProperty({
    description: 'Parcel ID that this boundary belongs to (references the LandRecord parcel ID)',
    example: 'PARCEL-001',
  })
  @IsString()
  @IsNotEmpty()
  parcelId: string;

  @ApiProperty({
    description:
      'GeoJSON Polygon or MultiPolygon geometry object. ' +
      'Coordinates must follow the [longitude, latitude] convention. ' +
      'Each ring must be closed (first and last coordinate identical) and contain at least 4 points.',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [3.379206, 6.524379],
          [3.380206, 6.524379],
          [3.380206, 6.525379],
          [3.379206, 6.525379],
          [3.379206, 6.524379],
        ],
      ],
    },
  })
  @IsObject()
  geoJson: Record<string, unknown>;
}
