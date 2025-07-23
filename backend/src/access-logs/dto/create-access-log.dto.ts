import { IsString, IsOptional, IsNumber, IsUUID, MaxLength } from "class-validator"

export class CreateAccessLogDto {
  @IsString()
  @MaxLength(500)
  routePath: string

  @IsString()
  @MaxLength(10)
  httpMethod: string

  @IsString()
  @MaxLength(45)
  ipAddress: string

  @IsOptional()
  @IsUUID()
  userId?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userAgent?: string

  @IsOptional()
  @IsNumber()
  statusCode?: number

  @IsOptional()
  @IsNumber()
  responseTime?: number
}
