import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateWorkflowDto {
  @ApiProperty({ description: 'UUID of the document to initiate verification for' })
  @IsUUID()
  documentId: string;
}
