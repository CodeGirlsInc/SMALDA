import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { UserRole } from "./user-role.entity"
import { RolePermission } from "./role-permission.entity"

export enum RoleType {
  ADMIN = "admin",
  ANALYST = "analyst",
  REVIEWER = "reviewer",
  USER = "user",
}

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({
    type: "enum",
    enum: RoleType,
    unique: true,
  })
  name: RoleType

  @Column({ nullable: true })
  description: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => UserRole,
    (userRole) => userRole.role,
  )
  userRoles: UserRole[]

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.role,
  )
  rolePermissions: RolePermission[]
}
