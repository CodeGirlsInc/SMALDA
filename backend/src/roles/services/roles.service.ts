import { Injectable, NotFoundException, ConflictException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Role, RoleType } from "../entities/role.entity"
import type { UserRole } from "../entities/user-role.entity"
import type { CreateRoleDto } from "../dto/create-role.dto"
import type { AssignRoleDto } from "../dto/assign-role.dto"

@Injectable()
export class RolesService {
  private roleRepository: Repository<Role>
  private userRoleRepository: Repository<UserRole>

  constructor(roleRepository: Repository<Role>, userRoleRepository: Repository<UserRole>) {
    this.roleRepository = roleRepository
    this.userRoleRepository = userRoleRepository
  }

  async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({
      where: { name: createRoleDto.name },
    })

    if (existingRole) {
      throw new ConflictException(`Role ${createRoleDto.name} already exists`)
    }

    const role = this.roleRepository.create(createRoleDto)
    return this.roleRepository.save(role)
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isActive: true },
      relations: ["rolePermissions", "rolePermissions.permission"],
    })
  }

  async findRoleByName(name: RoleType): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { name, isActive: true },
      relations: ["rolePermissions", "rolePermissions.permission"],
    })

    if (!role) {
      throw new NotFoundException(`Role ${name} not found`)
    }

    return role
  }

  async assignRoleToUser(assignRoleDto: AssignRoleDto): Promise<UserRole> {
    const role = await this.findRoleByName(assignRoleDto.roleName)

    const existingUserRole = await this.userRoleRepository.findOne({
      where: { userId: assignRoleDto.userId, role: { id: role.id } },
    })

    if (existingUserRole) {
      throw new ConflictException("User already has this role")
    }

    const userRole = this.userRoleRepository.create({
      userId: assignRoleDto.userId,
      role,
    })

    return this.userRoleRepository.save(userRole)
  }

  async removeRoleFromUser(userId: string, roleName: RoleType): Promise<void> {
    const role = await this.findRoleByName(roleName)

    const userRole = await this.userRoleRepository.findOne({
      where: { userId, role: { id: role.id } },
    })

    if (!userRole) {
      throw new NotFoundException("User role assignment not found")
    }

    await this.userRoleRepository.remove(userRole)
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ["role", "role.rolePermissions", "role.rolePermissions.permission"],
    })

    return userRoles.map((userRole) => userRole.role)
  }

  async hasRole(userId: string, roleName: RoleType): Promise<boolean> {
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        role: { name: roleName, isActive: true },
      },
      relations: ["role"],
    })

    return !!userRole
  }
}
