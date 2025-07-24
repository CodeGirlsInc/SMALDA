import { IsString, IsEnum, IsOptional, IsBoolean, IsObject } from "class-validator"
import { CommentType } from "../enums/review.enums"

export class AddCommentDto {
  @IsString()
  content: string

  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
