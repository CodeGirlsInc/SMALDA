import { IsEnum, IsOptional, IsString, IsObject, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleFrequency } from '../entities/report-schedule.entity';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Schedule name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Schedule description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Template ID to use for scheduled reports' })
  @IsUUID()
  templateId: string;

  @ApiProperty({ enum: ScheduleFrequency, description: 'Frequency of report generation' })
  @IsEnum(ScheduleFrequency)
  frequency: ScheduleFrequency;

  @ApiPropertyOptional({ description: 'Custom cron expression (if frequency is CUSTOM)' })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Filters to apply to scheduled reports' })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Email addresses to send reports to' })
  @IsArray()
  @IsOptional()
  recipients?: string[];
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Schedule name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Schedule description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ScheduleFrequency, description: 'Frequency of report generation' })
  @IsEnum(ScheduleFrequency)
  @IsOptional()
  frequency?: ScheduleFrequency;

  @ApiPropertyOptional({ description: 'Custom cron expression' })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Filters to apply' })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Email addresses to send reports to' })
  @IsArray()
  @IsOptional()
  recipients?: string[];

  @ApiPropertyOptional({ description: 'Whether schedule is active' })
  @IsOptional()
  isActive?: boolean;
}
