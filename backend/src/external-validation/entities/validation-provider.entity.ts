import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { ValidationType } from "./validation-type.enum" // Assuming ValidationType is declared in a separate enum file

export enum ProviderStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE",
  DEPRECATED = "DEPRECATED",
}

@Entity("validation_providers")
@Index(["validationType", "status"])
@Index(["isActive"])
export class ValidationProvider {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  name: string

  @Column()
  description: string

  @Column({
    type: "enum",
    enum: ValidationType,
  })
  validationType: ValidationType

  @Column()
  baseUrl: string

  @Column({ nullable: true })
  apiKey: string

  @Column("jsonb", { nullable: true })
  authConfig: Record<string, any>

  @Column("jsonb", { nullable: true })
  requestConfig: Record<string, any>

  @Column({
    type: "enum",
    enum: ProviderStatus,
    default: ProviderStatus.ACTIVE,
  })
  status: ProviderStatus

  @Column({ default: true })
  isActive: boolean

  @Column({ default: 0 })
  priority: number

  @Column({ default: 30000 })
  timeoutMs: number

  @Column({ default: 3 })
  maxRetries: number

  @Column("decimal", { precision: 5, scale: 2, default: 99.9 })
  slaUptime: number

  @Column("jsonb", { nullable: true })
  rateLimits: Record<string, any>

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
