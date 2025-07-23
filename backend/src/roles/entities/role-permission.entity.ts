import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { Role } from "./role.entity"
import { Permission } from "./permission.entity"

@Entity("role_permissions")
export class RolePermission {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @ManyToOne(
    () => Role,
    (role) => role.rolePermissions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "roleId" })
  role: Role

  @ManyToOne(
    () => Permission,
    (permission) => permission.rolePermissions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "permissionId" })
  permission: Permission

  @CreateDateColumn()
  createdAt: Date
}
