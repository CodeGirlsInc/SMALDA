import { IsNumber, IsOptional, IsString } from 'class-validator';

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
}
