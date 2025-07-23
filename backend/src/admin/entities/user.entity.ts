import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
  MODERATOR = "MODERATOR",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING = "PENDING",
}

@Entity("users")
@Index(["email"], { unique: true })
@Index(["role", "status"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  email: string

  @Column()
  firstName: string

  @Column()
  lastName: string

  @Column()
  passwordHash: string

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.USER,
  })
  @Index()
  role: UserRole

  @Column({
    type: "enum",
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  @Index()
  status: UserStatus

  @Column({ nullable: true })
  department: string

  @Column({ nullable: true })
  phoneNumber: string

  @Column({ type: "timestamp", nullable: true })
  lastLoginAt: Date

  @Column({ nullable: true })
  lastLoginIp: string

  @Column({ default: 0 })
  loginAttempts: number

  @Column({ type: "timestamp", nullable: true })
  lockedUntil: Date

  @Column("jsonb", { nullable: true })
  permissions: string[]

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Virtual properties
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  get isLocked(): boolean {
    return this.lockedUntil && this.lockedUntil > new Date()
  }
}
