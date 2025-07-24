import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"
import { ActivityAction } from "../enums/activity-action.enum"
import { ApiProperty } from "@nestjs/swagger"

@Entity("activities")
export class Activity {
  @ApiProperty({ description: "Unique identifier for the activity log" })
  @PrimaryGeneratedColumn("uuid")
  id: string

  @ApiProperty({ description: "ID of the user who performed the action", format: "uuid" })
  @Column({ type: "uuid" })
  userId: string

  @ApiProperty({ enum: ActivityAction, description: "Type of action performed" })
  @Column({ type: "enum", enum: ActivityAction })
  actionType: ActivityAction

  @ApiProperty({
    description: "Additional details or context about the activity",
    nullable: true,
    type: "object",
    additionalProperties: true,
  })
  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, any>

  @ApiProperty({ description: "Timestamp when the activity occurred" })
  @CreateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
  timestamp: Date
}
