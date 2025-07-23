import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { Role } from "./role.entity"

@Entity("user_roles")
export class UserRole {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column("uuid")
  userId: string

  @ManyToOne(
    () => Role,
    (role) => role.userRoles,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "roleId" })
  role: Role

  @CreateDateColumn()
  createdAt: Date
}
