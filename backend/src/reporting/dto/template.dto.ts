import { IsEnum, IsOptional, IsString, IsObject, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType, ReportFormat } from '../entities/report.entity';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ReportType, description: 'Type of report this template generates' })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({ 
    enum: ReportFormat, 
    isArray: true, 
    description: 'Supported export formats for this template' 
  })
  @IsArray()
  supportedFormats: ReportFormat[];

  @ApiProperty({ description: 'Template configuration (columns, charts, filters, styling)' })
  @IsObject()
  config: {
    columns?: string[];
    charts?: any[];
    filters?: any[];
    styling?: any;
    layout?: string;
  };

  @ApiPropertyOptional({ description: 'SQL query template' })
  @IsString()
  @IsOptional()
  queryTemplate?: string;

  @ApiPropertyOptional({ description: 'Whether template is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ 
    enum: ReportFormat, 
    isArray: true, 
    description: 'Supported export formats' 
  })
  @IsArray()
  @IsOptional()
  supportedFormats?: ReportFormat[];

  @ApiPropertyOptional({ description: 'Template configuration' })
  @IsObject()
  @IsOptional()
  config?: {
    columns?: string[];
    charts?: any[];
    filters?: any[];
    styling?: any;
    layout?: string;
  };

  @ApiPropertyOptional({ description: 'SQL query template' })
  @IsString()
  @IsOptional()
  queryTemplate?: string;

  @ApiPropertyOptional({ description: 'Whether template is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
