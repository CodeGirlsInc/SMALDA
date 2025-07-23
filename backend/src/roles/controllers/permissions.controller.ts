import { Controller, Get, Post, Param, Delete, UseGuards } from "@nestjs/common"
import type { PermissionsService } from "../services/permissions.service"
import type { CreatePermissionDto } from "../dto/create-permission.dto"
import { RoleType } from "../entities/role.entity"
import { Roles } from "../decorators/roles.decorator"
import { RolesGuard } from "../guards/roles.guard"
import { RequirePermissions } from "../decorators/permissions.decorator"
import { PermissionsGuard } from "../guards/permissions.guard"
import { PermissionAction, PermissionResource } from "../entities/permission.entity"

@Controller("permissions")
@UseGuards(RolesGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.ALL })
  create(createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.createPermission(createPermissionDto)
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ALL })
  findAll() {
    return this.permissionsService.findAllPermissions()
  }

  @Post("roles/:roleName/permissions/:permissionId")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.MANAGE, resource: PermissionResource.ROLE })
  assignPermissionToRole(@Param('roleName') roleName: RoleType, @Param('permissionId') permissionId: string) {
    return this.permissionsService.assignPermissionToRole(roleName, permissionId)
  }

  @Delete("roles/:roleName/permissions/:permissionId")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.MANAGE, resource: PermissionResource.ROLE })
  removePermissionFromRole(@Param('roleName') roleName: RoleType, @Param('permissionId') permissionId: string) {
    return this.permissionsService.removePermissionFromRole(roleName, permissionId)
  }

  @Get('users/:userId')
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.USER })
  getUserPermissions(@Param('userId') userId: string) {
    return this.permissionsService.getUserPermissions(userId);
  }
}
