import { Controller, Get, Post, Put, Delete, UseGuards, HttpCode, HttpStatus } from "@nestjs/common"
import type { UserManagementService } from "./services/user-management.service"
import type { AdminDashboardService } from "./services/admin-dashboard.service"
import type { CreateUserDto } from "./dto/create-user.dto"
import type { UpdateUserDto } from "./dto/update-user.dto"
import type { UserQueryDto, RiskReportQueryDto, DocumentStatsQueryDto } from "./dto/admin-query.dto"
import { AdminGuard, Roles } from "./guards/admin.guard"
import { UserRole } from "./entities/user.entity"
import type { User } from "./entities/user.entity"
import type {
  AdminDashboardStats,
  FlaggedDocument,
  SystemHealthMetrics,
  UserActivitySummary,
} from "./interfaces/admin-stats.interface"

@Controller("admin")
@UseGuards(AdminGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly adminDashboardService: AdminDashboardService,
  ) {}

  // Dashboard endpoints
  @Get("dashboard")
  async getDashboard(): Promise<AdminDashboardStats> {
    return await this.adminDashboardService.getDashboardStats()
  }

  @Get("system-health")
  async getSystemHealth(): Promise<SystemHealthMetrics> {
    return await this.adminDashboardService.getSystemHealth()
  }

  // User management endpoints
  @Post("users")
  @Roles(UserRole.SUPER_ADMIN) // Only super admins can create users
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    return await this.userManagementService.createUser(createUserDto)
  }

  @Get("users")
  async getUsers(query: UserQueryDto): Promise<{
    users: User[]
    total: number
    limit: number
    offset: number
  }> {
    return await this.userManagementService.findAll(query)
  }

  @Get("users/stats")
  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    suspended: number
    byRole: Record<string, number>
    byDepartment: Record<string, number>
    recentRegistrations: number
  }> {
    return await this.userManagementService.getUserStats()
  }

  @Get("users/activity")
  async getUserActivity(userId?: string): Promise<UserActivitySummary[]> {
    return await this.userManagementService.getUserActivitySummary(userId)
  }

  @Get("users/export")
  async exportUsers(query: UserQueryDto): Promise<User[]> {
    return await this.userManagementService.exportUsers(query)
  }

  @Get("users/:id")
  async getUser(id: string): Promise<User> {
    return await this.userManagementService.findOne(id)
  }

  @Put("users/:id")
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return await this.userManagementService.updateUser(id, updateUserDto)
  }

  @Delete("users/:id")
  @Roles(UserRole.SUPER_ADMIN) // Only super admins can delete users
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(id: string): Promise<void> {
    await this.userManagementService.deleteUser(id)
  }

  @Post("users/:id/suspend")
  async suspendUser(id: string, body: { reason?: string }): Promise<User> {
    return await this.userManagementService.suspendUser(id, body.reason)
  }

  @Post("users/:id/activate")
  async activateUser(id: string): Promise<User> {
    return await this.userManagementService.activateUser(id)
  }

  @Post("users/:id/lock")
  async lockUser(id: string, body: { hours?: number }): Promise<User> {
    return await this.userManagementService.lockUser(id, body.hours)
  }

  @Post("users/:id/unlock")
  async unlockUser(id: string): Promise<User> {
    return await this.userManagementService.unlockUser(id)
  }

  @Post("users/:id/reset-password")
  async resetPassword(id: string, body: { password: string }): Promise<{ message: string }> {
    await this.userManagementService.resetPassword(id, body.password)
    return { message: "Password reset successfully" }
  }

  @Post("users/bulk-update")
  async bulkUpdateUsers(body: { userIds: string[]; updateData: Partial<UpdateUserDto> }): Promise<{
    updatedCount: number
  }> {
    const updatedCount = await this.userManagementService.bulkUpdateUsers(body.userIds, body.updateData)
    return { updatedCount }
  }

  // Risk management endpoints
  @Get("risks/flagged")
  async getFlaggedDocuments(query: RiskReportQueryDto): Promise<{
    documents: FlaggedDocument[]
    total: number
    limit: number
    offset: number
  }> {
    return await this.adminDashboardService.getFlaggedDocuments(query)
  }

  @Get("documents/stats")
  async getDocumentStats(query: DocumentStatsQueryDto): Promise<{
    totalDocuments: number
    totalSize: number
    averageSize: number
    byMimeType: Record<string, { count: number; size: number }>
    byUploader: Record<string, number>
    uploadTrends: Array<{ date: string; count: number; size: number }>
    riskDistribution: Record<string, number>
  }> {
    return await this.adminDashboardService.getDocumentStats(query)
  }

  // Document moderation endpoints
  @Post("documents/:id/moderate")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  async moderateDocument(
    documentId: string,
    body: {
      action: "approve" | "reject" | "quarantine"
      moderatorId: string
      comments?: string
    },
  ): Promise<{ message: string }> {
    await this.adminDashboardService.moderateDocument(documentId, body.action, body.moderatorId, body.comments)
    return { message: `Document ${body.action}d successfully` }
  }

  @Post("documents/:id/approve")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  async approveDocument(
    documentId: string,
    body: { moderatorId: string; comments?: string },
  ): Promise<{ message: string }> {
    await this.adminDashboardService.moderateDocument(documentId, "approve", body.moderatorId, body.comments)
    return { message: "Document approved successfully" }
  }

  @Post("documents/:id/reject")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  async rejectDocument(
    documentId: string,
    body: { moderatorId: string; reason: string; comments?: string },
  ): Promise<{ message: string }> {
    await this.adminDashboardService.moderateDocument(
      documentId,
      "reject",
      body.moderatorId,
      `${body.reason}. ${body.comments || ""}`,
    )
    return { message: "Document rejected successfully" }
  }

  @Post("documents/:id/quarantine")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async quarantineDocument(
    documentId: string,
    body: { moderatorId: string; reason: string },
  ): Promise<{ message: string }> {
    await this.adminDashboardService.moderateDocument(documentId, "quarantine", body.moderatorId, body.reason)
    return { message: "Document quarantined successfully" }
  }
}
