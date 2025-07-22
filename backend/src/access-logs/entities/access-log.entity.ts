import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

@Entity("access_logs")
@Index(["userId", "createdAt"])
@Index(["createdAt"])
@Index(["ipAddress"])
export class AccessLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "route_path", length: 500 })
  routePath: string

  @Column({ name: "http_method", length: 10 })
  httpMethod: string

  @Column({ name: "ip_address", length: 45 })
  ipAddress: string

  @Column({ name: "user_id", nullable: true })
  userId?: string

  @Column({ name: "user_agent", length: 1000, nullable: true })
  userAgent?: string

  @Column({ name: "status_code", nullable: true })
  statusCode?: number

  @Column({ name: "response_time", nullable: true })
  responseTime?: number

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date
}
