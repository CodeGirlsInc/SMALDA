import { IsEnum, IsOptional, IsString, IsBoolean } from "class-validator"
import { PermissionAction, PermissionResource } from "../entities/permission.entity"

export class CreatePermissionDto {
  @IsEnum(PermissionAction)
  action: PermissionAction

  @IsEnum(PermissionResource)
  resource: PermissionResource

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
