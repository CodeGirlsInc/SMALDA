import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { GeoJsonGeometry } from '../interfaces/geo-json.interface';

@Entity('parcel_boundaries')
@Index(['parcelId'], { unique: true })
export class ParcelBoundary {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Parcel ID — references the parcelId on a LandRecord',
    example: 'PARCEL-001',
  })
  @Column({ unique: true })
  parcelId: string;

  @ApiProperty({
    description:
      'Raw GeoJSON Polygon or MultiPolygon geometry stored as JSONB. ' +
      'Coordinates follow the [longitude, latitude] convention.',
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
  @Column({ type: 'jsonb' })
  geoJson: GeoJsonGeometry;

  @ApiProperty({
    description:
      'Approximate area of the parcel in square metres, computed from the GeoJSON geometry ' +
      'using an equirectangular projection (Shoelace formula). ' +
      'Accurate for small parcels; use PostGIS for precise calculations.',
    example: 12345.67,
  })
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  area: number;

  @ApiProperty({ description: 'Timestamp when the boundary record was created' })
  @CreateDateColumn()
  createdAt: Date;
}
