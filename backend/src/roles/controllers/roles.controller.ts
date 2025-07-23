import { Controller, Get, Post, Param, Delete, UseGuards } from "@nestjs/common"
import type { RolesService } from "../services/roles.service"
import type { CreateRoleDto } from "../dto/create-role.dto"
import type { AssignRoleDto } from "../dto/assign-role.dto"
import { RoleType } from "../entities/role.entity"
import { Roles } from "../decorators/roles.decorator"
import { RolesGuard } from "../guards/roles.guard"
import { RequirePermissions } from "../decorators/permissions.decorator"
import { PermissionsGuard } from "../guards/permissions.guard"
import { PermissionAction, PermissionResource } from "../entities/permission.entity"

@Controller("roles")
@UseGuards(RolesGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.ROLE })
  create(createRoleDto: CreateRoleDto) {
    return this.rolesService.createRole(createRoleDto)
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ROLE })
  findAll() {
    return this.rolesService.findAllRoles()
  }

  @Get(':name')
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ROLE })
  findOne(@Param('name') name: RoleType) {
    return this.rolesService.findRoleByName(name);
  }

  @Post("assign")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.MANAGE, resource: PermissionResource.USER })
  assignRole(assignRoleDto: AssignRoleDto) {
    return this.rolesService.assignRoleToUser(assignRoleDto)
  }

  @Delete("users/:userId/roles/:roleName")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.MANAGE, resource: PermissionResource.USER })
  removeRole(@Param('userId') userId: string, @Param('roleName') roleName: RoleType) {
    return this.rolesService.removeRoleFromUser(userId, roleName)
  }

  @Get('users/:userId')
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.USER })
  getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }
}
