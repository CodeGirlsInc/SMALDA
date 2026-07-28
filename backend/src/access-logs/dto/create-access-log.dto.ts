import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AccessAction } from '../entities/access-log.entity';

export class CreateAccessLogDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsString()
  routePath: string;

  @IsString()
  httpMethod: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsEnum(AccessAction)
  action?: AccessAction;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  isAdmin?: boolean;
}
