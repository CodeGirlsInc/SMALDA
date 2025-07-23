import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional } from "class-validator"

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  authorName?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  authorEmail?: string
}
