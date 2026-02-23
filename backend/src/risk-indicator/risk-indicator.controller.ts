import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateRiskIndicatorDto } from './dto/create-risk-indicator.dto';
import { RiskIndicator } from './entities/risk-indicator.entity';
import { RiskIndicatorService } from './risk-indicator.service';

@ApiTags('Risk Indicators')
@Controller('risk-indicators')
export class RiskIndicatorController {
  constructor(private readonly riskIndicatorService: RiskIndicatorService) {}

  @Post()
  @ApiOperation({ summary: 'Record a new risk indicator detected during document analysis' })
  @ApiResponse({ status: 201, description: 'Risk indicator created', type: RiskIndicator })
  create(@Body() dto: CreateRiskIndicatorDto): Promise<RiskIndicator> {
    return this.riskIndicatorService.createIndicator(dto);
  }

  @Get('unresolved')
  @ApiOperation({ summary: 'List all unresolved risk indicators across all documents' })
  @ApiResponse({ status: 200, description: 'List of unresolved indicators', type: [RiskIndicator] })
  getUnresolved(): Promise<RiskIndicator[]> {
    return this.riskIndicatorService.getUnresolved();
  }

  @Get('document/:documentId')
  @ApiOperation({ summary: 'Get all risk indicators for a specific document' })
  @ApiParam({ name: 'documentId', description: 'UUID of the document' })
  @ApiResponse({ status: 200, description: 'List of indicators for the document', type: [RiskIndicator] })
  findByDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<RiskIndicator[]> {
    return this.riskIndicatorService.findByDocument(documentId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Mark a risk indicator as resolved' })
  @ApiParam({ name: 'id', description: 'UUID of the risk indicator' })
  @ApiResponse({ status: 200, description: 'Indicator marked as resolved', type: RiskIndicator })
  @ApiResponse({ status: 404, description: 'Indicator not found' })
  resolve(@Param('id', ParseUUIDPipe) id: string): Promise<RiskIndicator> {
    return this.riskIndicatorService.resolveIndicator(id);
  }
}
