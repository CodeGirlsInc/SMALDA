import { Injectable, NotFoundException, ConflictException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type Permission, type PermissionAction, PermissionResource } from "../entities/permission.entity"
import type { RolePermission } from "../entities/role-permission.entity"
import type { Role, RoleType } from "../entities/role.entity"
import type { CreatePermissionDto } from "../dto/create-permission.dto"

@Injectable()
export class PermissionsService {
  constructor(
    private permissionRepository: Repository<Permission>,
    private rolePermissionRepository: Repository<RolePermission>,
    private roleRepository: Repository<Role>,
  ) {}

  async createPermission(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    const existingPermission = await this.permissionRepository.findOne({
      where: {
        action: createPermissionDto.action,
        resource: createPermissionDto.resource,
      },
    })

    if (existingPermission) {
      throw new ConflictException("Permission already exists")
    }

    const permission = this.permissionRepository.create(createPermissionDto)
    return this.permissionRepository.save(permission)
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { isActive: true },
    })
  }

  async assignPermissionToRole(roleName: RoleType, permissionId: string): Promise<RolePermission> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName, isActive: true },
    })

    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`)
    }

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId, isActive: true },
    })

    if (!permission) {
      throw new NotFoundException("Permission not found")
    }

    const existingRolePermission = await this.rolePermissionRepository.findOne({
      where: { role: { id: role.id }, permission: { id: permission.id } },
    })

    if (existingRolePermission) {
      throw new ConflictException("Role already has this permission")
    }

    const rolePermission = this.rolePermissionRepository.create({
      role,
      permission,
    })

    return this.rolePermissionRepository.save(rolePermission)
  }

  async removePermissionFromRole(roleName: RoleType, permissionId: string): Promise<void> {
    const rolePermission = await this.rolePermissionRepository.findOne({
      where: {
        role: { name: roleName },
        permission: { id: permissionId },
      },
    })

    if (!rolePermission) {
      throw new NotFoundException("Role permission assignment not found")
    }

    await this.rolePermissionRepository.remove(rolePermission)
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const rolePermissions = await this.rolePermissionRepository
      .createQueryBuilder("rp")
      .innerJoin("rp.role", "role")
      .innerJoin("user_roles", "ur", "ur.roleId = role.id")
      .innerJoin("rp.permission", "permission")
      .where("ur.userId = :userId", { userId })
      .andWhere("role.isActive = :isActive", { isActive: true })
      .andWhere("permission.isActive = :isActive", { isActive: true })
      .getMany()

    return rolePermissions.map((rp) => rp.permission)
  }

  async hasPermission(userId: string, action: PermissionAction, resource: PermissionResource): Promise<boolean> {
    const rolePermission = await this.rolePermissionRepository
      .createQueryBuilder("rp")
      .innerJoin("rp.role", "role")
      .innerJoin("user_roles", "ur", "ur.roleId = role.id")
      .innerJoin("rp.permission", "permission")
      .where("ur.userId = :userId", { userId })
      .andWhere("permission.action = :action", { action })
      .andWhere("permission.resource IN (:...resources)", {
        resources: [resource, PermissionResource.ALL],
      })
      .andWhere("role.isActive = :isActive", { isActive: true })
      .andWhere("permission.isActive = :isActive", { isActive: true })
      .getOne()

    return !!rolePermission
  }
}
