import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAccessLogDto {
  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsString()
  routePath: string;

  @IsString()
  httpMethod: string;

  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @IsString()
  action?: string | null;

  @IsOptional()
  @IsString()
  resourceType?: string | null;

  @IsOptional()
  @IsString()
  resourceId?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  userAgent?: string | null;
}
