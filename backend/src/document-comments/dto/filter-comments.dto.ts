import { IsOptional, IsUUID, IsDateString, IsBoolean, IsNumber, Min } from "class-validator"
import { Transform, Type } from "class-transformer"

export class FilterCommentsDto {
  @IsUUID()
  documentId: string

  @IsOptional()
  @IsUUID()
  authorId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  includeDeleted?: boolean = false

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  threaded?: boolean = true

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  sortByDateDesc?: boolean = false
}
