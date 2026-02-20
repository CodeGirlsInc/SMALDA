import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowState } from '../enums/workflow-state.enum';

export class TransitionWorkflowDto {
  @ApiProperty({
    enum: WorkflowState,
    description: 'The target state to transition the workflow into',
    example: WorkflowState.HASHING,
  })
  @IsEnum(WorkflowState)
  newState: WorkflowState;

  @ApiPropertyOptional({
    description: 'Optional human-readable note explaining the reason for this transition',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
