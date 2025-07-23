import { SetMetadata } from "@nestjs/common"
import type { PermissionAction, PermissionResource } from "../entities/permission.entity"

export const PERMISSIONS_KEY = "permissions"

export interface RequiredPermission {
  action: PermissionAction
  resource: PermissionResource
}

export const RequirePermissions = (...permissions: RequiredPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions)
