import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class SharedDocumentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;
}
