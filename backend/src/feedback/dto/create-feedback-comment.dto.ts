{
  ;`import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackCommentDto {
  @ApiProperty({ description: 'The text content of the comment' })
  @IsNotEmpty()
  @IsString()
  commentText: string;

  @ApiProperty({ description: 'ID of the user who made the comment', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}`
}
