import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Between, In } from "typeorm"
import * as bcrypt from "bcrypt"
import type { User } from "../entities/user.entity"
import { UserStatus } from "../entities/user.entity"
import type { CreateUserDto } from "../dto/create-user.dto"
import type { UpdateUserDto } from "../dto/update-user.dto"
import type { UserQueryDto } from "../dto/admin-query.dto"
import type { UserActivitySummary } from "../interfaces/admin-stats.interface"

@Injectable()
export class UserManagementService {
  constructor(private userRepository: Repository<User>) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    })

    if (existingUser) {
      throw new ConflictException("User with this email already exists")
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds)

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      passwordHash,
    })

    // Remove password from DTO before saving
    delete (createUserDto as any).password

    return await this.userRepository.save(user)
  }

  async findAll(query: UserQueryDto): Promise<{
    users: User[]
    total: number
    limit: number
    offset: number
  }> {
    const { role, status, department, search, startDate, endDate, limit = 50, offset = 0 } = query

    const whereConditions: any = {}

    if (role) {
      whereConditions.role = role
    }

    if (status) {
      whereConditions.status = status
    }

    if (department) {
      whereConditions.department = department
    }

    if (startDate && endDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date(endDate))
    }

    let queryBuilder = this.userRepository.createQueryBuilder("user")

    // Apply where conditions
    Object.entries(whereConditions).forEach(([key, value]) => {
      if (key === "createdAt") {
        queryBuilder = queryBuilder.andWhere(`user.${key} BETWEEN :startDate AND :endDate`, {
          startDate: value.from,
          endDate: value.to,
        })
      } else {
        queryBuilder = queryBuilder.andWhere(`user.${key} = :${key}`, { [key]: value })
      }
    })

    // Apply search
    if (search) {
      queryBuilder = queryBuilder.andWhere(
        "(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)",
        { search: `%${search}%` },
      )
    }

    // Apply pagination and ordering
    queryBuilder = queryBuilder.orderBy("user.createdAt", "DESC").take(limit).skip(offset)

    const [users, total] = await queryBuilder.getManyAndCount()

    return {
      users,
      total,
      limit,
      offset,
    }
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    })

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    return user
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id)

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      })

      if (existingUser) {
        throw new ConflictException("User with this email already exists")
      }
    }

    // Update user
    Object.assign(user, updateUserDto)
    return await this.userRepository.save(user)
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findOne(id)
    await this.userRepository.remove(user)
  }

  async suspendUser(id: string, reason?: string): Promise<User> {
    const user = await this.findOne(id)
    user.status = UserStatus.SUSPENDED
    user.metadata = {
      ...user.metadata,
      suspendedAt: new Date().toISOString(),
      suspensionReason: reason,
    }
    return await this.userRepository.save(user)
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.findOne(id)
    user.status = UserStatus.ACTIVE
    user.lockedUntil = null
    user.loginAttempts = 0
    user.metadata = {
      ...user.metadata,
      activatedAt: new Date().toISOString(),
    }
    return await this.userRepository.save(user)
  }

  async lockUser(id: string, lockDurationHours = 24): Promise<User> {
    const user = await this.findOne(id)
    const lockUntil = new Date()
    lockUntil.setHours(lockUntil.getHours() + lockDurationHours)

    user.lockedUntil = lockUntil
    user.metadata = {
      ...user.metadata,
      lockedAt: new Date().toISOString(),
      lockDurationHours,
    }

    return await this.userRepository.save(user)
  }

  async unlockUser(id: string): Promise<User> {
    const user = await this.findOne(id)
    user.lockedUntil = null
    user.loginAttempts = 0
    user.metadata = {
      ...user.metadata,
      unlockedAt: new Date().toISOString(),
    }
    return await this.userRepository.save(user)
  }

  async resetPassword(id: string, newPassword: string): Promise<User> {
    const user = await this.findOne(id)

    if (newPassword.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters long")
    }

    const saltRounds = 12
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds)
    user.metadata = {
      ...user.metadata,
      passwordResetAt: new Date().toISOString(),
    }

    return await this.userRepository.save(user)
  }

  async getUserActivitySummary(userId?: string): Promise<UserActivitySummary[]> {
    // This would typically involve complex queries across multiple tables
    // For now, we'll return a mock implementation
    const users = userId ? [await this.findOne(userId)] : await this.userRepository.find({ take: 100 })

    return users.map((user) => ({
      userId: user.id,
      userEmail: user.email,
      fullName: user.fullName,
      documentsUploaded: 0, // Would be calculated from documents table
      documentsAnalyzed: 0, // Would be calculated from risk_analyses table
      lastActivity: user.lastLoginAt || user.updatedAt,
      riskDocuments: 0, // Would be calculated from risk_analyses table
      auditLogCount: 0, // Would be calculated from audit_logs table
      status: user.status,
      role: user.role,
    }))
  }

  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    suspended: number
    byRole: Record<string, number>
    byDepartment: Record<string, number>
    recentRegistrations: number
  }> {
    const users = await this.userRepository.find()

    const stats = {
      total: users.length,
      active: users.filter((u) => u.status === UserStatus.ACTIVE).length,
      inactive: users.filter((u) => u.status === UserStatus.INACTIVE).length,
      suspended: users.filter((u) => u.status === UserStatus.SUSPENDED).length,
      byRole: {} as Record<string, number>,
      byDepartment: {} as Record<string, number>,
      recentRegistrations: 0,
    }

    // Calculate role distribution
    users.forEach((user) => {
      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1
      if (user.department) {
        stats.byDepartment[user.department] = (stats.byDepartment[user.department] || 0) + 1
      }
    })

    // Calculate recent registrations (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    stats.recentRegistrations = users.filter((u) => u.createdAt >= sevenDaysAgo).length

    return stats
  }

  async bulkUpdateUsers(userIds: string[], updateData: Partial<UpdateUserDto>): Promise<number> {
    const result = await this.userRepository.update({ id: In(userIds) }, updateData)

    return result.affected || 0
  }

  async exportUsers(query?: UserQueryDto): Promise<User[]> {
    const { users } = await this.findAll({ ...query, limit: 10000, offset: 0 })
    return users
  }
}
