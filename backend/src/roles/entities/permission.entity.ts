import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { RolePermission } from "./role-permission.entity"

export enum PermissionAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  MANAGE = "manage",
}

export enum PermissionResource {
  USER = "user",
  ROLE = "role",
  REPORT = "report",
  ANALYTICS = "analytics",
  REVIEW = "review",
  ALL = "all",
}

@Entity("permissions")
export class Permission {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({
    type: "enum",
    enum: PermissionAction,
  })
  action: PermissionAction

  @Column({
    type: "enum",
    enum: PermissionResource,
  })
  resource: PermissionResource

  @Column({ nullable: true })
  description: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions: RolePermission[]
}
