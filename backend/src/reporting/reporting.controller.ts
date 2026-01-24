import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
  Patch,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UserRole } from '../common/enums/user.enum';
import { ReportingService } from './services/reporting.service';
import { ScheduleService } from './services/schedule.service';
import { TemplateService } from './services/template.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportFilterDto } from './dto/report-filter.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import * as fs from 'fs';

@ApiTags('Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly scheduleService: ScheduleService,
    private readonly templateService: TemplateService,
  ) {}

  // Report Endpoints
  @Post()
  @ApiOperation({ summary: 'Generate a new report' })
  @ApiResponse({ status: 201, description: 'Report generation initiated' })
  async generateReport(
    @GetUser('id') userId: string,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reportingService.generateReport(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports for current user' })
  @ApiResponse({ status: 200, description: 'Returns list of reports' })
  async findAllReports(
    @GetUser('id') userId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.reportingService.findAll(userId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific report' })
  @ApiResponse({ status: 200, description: 'Returns report details' })
  async findOneReport(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.reportingService.findOne(userId, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a report file' })
  @ApiResponse({ status: 200, description: 'Returns report file' })
  async downloadReport(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName } = await this.reportingService.downloadReport(userId, id);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a report' })
  @ApiResponse({ status: 200, description: 'Report deleted successfully' })
  async deleteReport(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.reportingService.delete(userId, id);
    return { message: 'Report deleted successfully' };
  }

  // Template Endpoints
  @Post('templates')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new report template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @GetUser('id') userId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templateService.create(userId, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all report templates' })
  @ApiResponse({ status: 200, description: 'Returns list of templates' })
  async findAllTemplates(@Query('includeInactive') includeInactive?: boolean) {
    return this.templateService.findAll(includeInactive);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get a specific template' })
  @ApiResponse({ status: 200, description: 'Returns template details' })
  async findOneTemplate(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Put('templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a report template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, dto);
  }

  @Delete('templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a report template' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(@Param('id') id: string) {
    await this.templateService.delete(id);
    return { message: 'Template deleted successfully' };
  }

  // Schedule Endpoints
  @Post('schedules')
  @ApiOperation({ summary: 'Create a new report schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  async createSchedule(
    @GetUser('id') userId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.scheduleService.create(userId, dto);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get all report schedules for current user' })
  @ApiResponse({ status: 200, description: 'Returns list of schedules' })
  async findAllSchedules(@GetUser('id') userId: string) {
    return this.scheduleService.findAll(userId);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get a specific schedule' })
  @ApiResponse({ status: 200, description: 'Returns schedule details' })
  async findOneSchedule(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.scheduleService.findOne(userId, id);
  }

  @Put('schedules/:id')
  @ApiOperation({ summary: 'Update a report schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  async updateSchedule(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.update(userId, id, dto);
  }

  @Patch('schedules/:id/toggle')
  @ApiOperation({ summary: 'Toggle schedule active status' })
  @ApiResponse({ status: 200, description: 'Schedule toggled successfully' })
  async toggleSchedule(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.scheduleService.toggleActive(userId, id);
  }

  @Delete('schedules/:id')
  @ApiOperation({ summary: 'Delete a report schedule' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  async deleteSchedule(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.scheduleService.delete(userId, id);
    return { message: 'Schedule deleted successfully' };
  }
}
