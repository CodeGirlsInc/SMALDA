{
  ;`import { PartialType } from '@nestjs/swagger';
import { CreateFeedbackCommentDto } from './create-feedback-comment.dto';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFeedbackCommentDto extends PartialType(CreateFeedbackCommentDto) {
  @ApiProperty({ description: 'Updated text content of the comment', required: false })
  @IsOptional()
  @IsString()
  commentText?: string;
}`
}
