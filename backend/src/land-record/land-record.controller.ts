import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LandRecordService } from './land-record.service';
import { LandRecord } from './entities/land-record.entity';
import { CreateLandRecordDto } from './dto/create-land-record.dto';
import { UpdateLandRecordDto } from './dto/update-land-record.dto';
import { FilterLandRecordDto } from './dto/filter-land-record.dto';

@ApiTags('Land Records')
@Controller('land-records')
export class LandRecordController {
  constructor(private readonly landRecordService: LandRecordService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new land record' })
  @ApiResponse({ status: 201, description: 'Land record created', type: LandRecord })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 409, description: 'Parcel ID already exists' })
  create(@Body() dto: CreateLandRecordDto): Promise<LandRecord> {
    return this.landRecordService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all land records with optional filtering by status and location' })
  @ApiResponse({ status: 200, description: 'List of land records', type: [LandRecord] })
  findAll(@Query() filters: FilterLandRecordDto): Promise<LandRecord[]> {
    return this.landRecordService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a single land record by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the land record' })
  @ApiResponse({ status: 200, description: 'Land record found', type: LandRecord })
  @ApiResponse({ status: 404, description: 'Land record not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LandRecord> {
    return this.landRecordService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing land record' })
  @ApiParam({ name: 'id', description: 'UUID of the land record' })
  @ApiResponse({ status: 200, description: 'Land record updated', type: LandRecord })
  @ApiResponse({ status: 404, description: 'Land record not found' })
  @ApiResponse({ status: 409, description: 'Parcel ID already taken by another record' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLandRecordDto,
  ): Promise<LandRecord> {
    return this.landRecordService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a land record' })
  @ApiParam({ name: 'id', description: 'UUID of the land record' })
  @ApiResponse({ status: 204, description: 'Land record soft-deleted' })
  @ApiResponse({ status: 404, description: 'Land record not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.landRecordService.remove(id);
  }
}
