import { IsString, IsNotEmpty, IsUUID, IsOptional, MaxLength, MinLength } from "class-validator"

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  documentId: string

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  content: string

  @IsOptional()
  @IsUUID()
  parentCommentId?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  authorName: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  authorEmail: string

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  authorId: string
}
