import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CourtCasesService } from './court-cases.service';
import { CreateCourtCaseDto } from './dto/create-court-case.dto';
import { AnalysisQueryDto } from './dto/analysis-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiQuery } from '@nestjs/swagger';

@ApiTags('Court Cases')
@Controller('court-cases')
export class CourtCasesController {
  constructor(private readonly courtCasesService: CourtCasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new court case' })
  @ApiResponse({ status: 201, description: 'Court case created successfully' })
  async create(@Body() createCourtCaseDto: CreateCourtCaseDto) {
    return await this.courtCasesService.create(createCourtCaseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all court cases with optional filtering' })
  @ApiResponse({ status: 200, description: 'List of court cases' })
  async findAll(@Query() query: AnalysisQueryDto) {
    return await this.courtCasesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific court case by ID' })
  @ApiResponse({ status: 200, description: 'Court case details' })
  @ApiResponse({ status: 404, description: 'Court case not found' })
  async findOne(@Param('id') id: string) {
    return await this.courtCasesService.findOne(id);
  }

  @Post('import/json')
  @ApiOperation({ summary: 'Import court cases from JSON data' })
  @ApiResponse({ status: 201, description: 'Cases imported successfully' })
  async importJson(@Body() cases: CreateCourtCaseDto[]) {
    if (!Array.isArray(cases)) {
      throw new BadRequestException('Expected an array of court cases');
    }
    return await this.courtCasesService.importFromJson(cases);
  }

  @Post('import/file')
  @ApiOperation({ summary: 'Import court cases from JSON file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const jsonData = JSON.parse(file.buffer.toString());
      if (!Array.isArray(jsonData)) {
        throw new BadRequestException('File must contain an array of court cases');
      }
      return await this.courtCasesService.importFromJson(jsonData);
    } catch (error) {
      throw new BadRequestException(`Invalid JSON file: ${error.message}`);
    }
  }

  // Statistical Analysis Endpoints

  @Get('analytics/comprehensive')
  @ApiOperation({ summary: 'Get comprehensive statistical analysis' })
  @ApiResponse({ status: 200, description: 'Comprehensive statistics' })
  async getComprehensiveStats(@Query() query: AnalysisQueryDto) {
    return await this.courtCasesService.getComprehensiveStats(query);
  }

  @Get('analytics/win-rates')
  @ApiOperation({ summary: 'Get win rate statistics by region and case type' })
  @ApiResponse({ status: 200, description: 'Win rate statistics' })
  async getWinRates(@Query() query: AnalysisQueryDto) {
    return await this.courtCasesService.getWinRateStats(query);
  }

  @Get('analytics/resolution-times')
  @ApiOperation({ summary: 'Get time-to-resolution statistics' })
  @ApiResponse({ status: 200, description: 'Resolution time statistics' })
  async getResolutionTimes(@Query() query: AnalysisQueryDto) {
    return await this.courtCasesService.getTimeToResolutionStats(query);
  }

  @Get('analytics/regions')
  @ApiOperation({ summary: 'Get detailed statistics by region' })
  @ApiResponse({ status: 200, description: 'Regional statistics' })
  async getRegionStats(@Query() query: AnalysisQueryDto) {
    return await this.courtCasesService.getRegionStats(query);
  }
}
