import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ParcelBoundaryService } from './parcel-boundary.service';
import { SaveBoundaryDto } from './dto/save-boundary.dto';
import { OverlapResultDto } from './dto/overlap-result.dto';
import { ParcelBoundary } from './entities/parcel-boundary.entity';

@ApiTags('Parcel Boundaries')
@Controller('parcel-boundaries')
export class ParcelBoundaryController {
  constructor(
    private readonly parcelBoundaryService: ParcelBoundaryService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Save or update a parcel boundary',
    description:
      'Validates the supplied GeoJSON Polygon/MultiPolygon, computes its approximate area, ' +
      'and stores it. If a boundary for the parcel already exists it is overwritten.',
  })
  @ApiBody({ type: SaveBoundaryDto })
  @ApiResponse({
    status: 201,
    description: 'Boundary saved successfully.',
    type: ParcelBoundary,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid GeoJSON structure (not a closed Polygon/MultiPolygon).',
  })
  saveBoundary(@Body() dto: SaveBoundaryDto): Promise<ParcelBoundary> {
    return this.parcelBoundaryService.saveBoundary(dto.parcelId, dto.geoJson);
  }

  @Get(':parcelId')
  @ApiOperation({
    summary: 'Retrieve a stored parcel boundary',
    description: 'Returns the GeoJSON geometry and computed area for the given parcel.',
  })
  @ApiParam({
    name: 'parcelId',
    description: 'The parcel ID whose boundary should be retrieved',
    example: 'PARCEL-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Boundary record found.',
    type: ParcelBoundary,
  })
  @ApiResponse({ status: 404, description: 'No boundary found for this parcel ID.' })
  getBoundary(@Param('parcelId') parcelId: string): Promise<ParcelBoundary> {
    return this.parcelBoundaryService.getBoundary(parcelId);
  }

  @Get(':parcelId/overlaps')
  @ApiOperation({
    summary: 'Detect potential boundary overlaps',
    description:
      'Returns all other parcels that share at least one exact coordinate point with the given parcel. ' +
      'Results are sorted by shared coordinate count (descending). ' +
      'This is a heuristic — it does not perform true geometric intersection. ' +
      'Enable PostGIS for precise overlap detection.',
  })
  @ApiParam({
    name: 'parcelId',
    description: 'The parcel ID to check for potential overlaps',
    example: 'PARCEL-001',
  })
  @ApiResponse({
    status: 200,
    description: 'List of potentially overlapping parcels (may be empty).',
    type: [OverlapResultDto],
  })
  @ApiResponse({ status: 404, description: 'No boundary found for this parcel ID.' })
  findPotentialOverlaps(
    @Param('parcelId') parcelId: string,
  ): Promise<OverlapResultDto[]> {
    return this.parcelBoundaryService.findPotentialOverlaps(parcelId);
  }
}
