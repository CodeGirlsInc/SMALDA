import { IsUUID, IsEnum } from "class-validator"
import { RoleType } from "../entities/role.entity"

export class AssignRoleDto {
  @IsUUID()
  userId: string

  @IsEnum(RoleType)
  roleName: RoleType
}
