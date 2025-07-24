import { IsNotEmpty, IsUUID, IsEnum, IsOptional, IsObject } from "class-validator"
import { ActivityAction } from "../enums/activity-action.enum"
import { ApiProperty } from "@nestjs/swagger"

export class CreateActivityDto {
  @ApiProperty({ description: "ID of the user who performed the action", format: "uuid" })
  @IsNotEmpty()
  @IsUUID()
  userId: string

  @ApiProperty({ enum: ActivityAction, description: "Type of action performed" })
  @IsNotEmpty()
  @IsEnum(ActivityAction)
  actionType: ActivityAction

  @ApiProperty({
    description: "Additional details or context about the activity",
    required: false,
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>
}
