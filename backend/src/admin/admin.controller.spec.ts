import { Test, type TestingModule } from "@nestjs/testing"
import { AdminController } from "./admin.controller"
import { UserManagementService } from "./services/user-management.service"
import { AdminDashboardService } from "./services/admin-dashboard.service"
import { AdminGuard } from "./guards/admin.guard"
import { type User, UserRole, UserStatus } from "./entities/user.entity"
import type { CreateUserDto } from "./dto/create-user.dto"
import type { UpdateUserDto } from "./dto/update-user.dto"
import type { UserQueryDto } from "./dto/admin-query.dto"
import type { AdminDashboardStats } from "./interfaces/admin-stats.interface"
import { jest } from "@jest/globals"

describe("AdminController", () => {
  let controller: AdminController
  let userManagementService: UserManagementService
  let adminDashboardService: AdminDashboardService

  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    passwordHash: "hashedpassword",
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    department: "IT",
    phoneNumber: "+1234567890",
    lastLoginAt: new Date(),
    lastLoginIp: "192.168.1.1",
    loginAttempts: 0,
    lockedUntil: null,
    permissions: ["read", "write"],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    fullName: "John Doe",
    isLocked: false,
  }

  const mockDashboardStats: AdminDashboardStats = {
    users: {
      total: 100,
      active: 85,
      inactive: 15,
      byRole: { USER: 80, ADMIN: 15, SUPER_ADMIN: 3, MODERATOR: 2 },
      byStatus: { ACTIVE: 85, INACTIVE: 10, SUSPENDED: 3, PENDING: 2 },
      recentRegistrations: 5,
    },
    documents: {
      total: 500,
      totalSize: 1024000000,
      byMimeType: { "application/pdf": 300, "image/jpeg": 150, "text/plain": 50 },
      uploadedToday: 10,
      uploadedThisWeek: 45,
      uploadedThisMonth: 120,
    },
    riskAnalysis: {
      total: 450,
      byRiskLevel: { LOW: 200, MEDIUM: 150, HIGH: 80, CRITICAL: 20 },
      flaggedDocuments: 100,
      pendingReview: 25,
      averageRiskScore: 35.5,
      highRiskDocuments: 80,
      criticalRiskDocuments: 20,
    },
    auditLogs: {
      totalLogs: 10000,
      failedOperations: 50,
      suspiciousActivity: 15,
      todayActivity: 200,
      topActions: [{ action: "UPLOAD_DOCUMENT", count: 300 }],
      topUsers: [{ userId: "user-1", userEmail: "user1@example.com", count: 150 }],
    },
    notifications: {
      totalSent: 2000,
      totalFailed: 25,
      unreadCount: 150,
      byType: { EMAIL: 1500, IN_APP: 500 },
      byEvent: { RISK_DETECTED: 800, REVIEW_APPROVED: 600 },
    },
  }

  const mockUserManagementService = {
    createUser: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    suspendUser: jest.fn(),
    activateUser: jest.fn(),
    lockUser: jest.fn(),
    unlockUser: jest.fn(),
    resetPassword: jest.fn(),
    getUserStats: jest.fn(),
    getUserActivitySummary: jest.fn(),
    exportUsers: jest.fn(),
    bulkUpdateUsers: jest.fn(),
  }

  const mockAdminDashboardService = {
    getDashboardStats: jest.fn(),
    getSystemHealth: jest.fn(),
    getFlaggedDocuments: jest.fn(),
    getDocumentStats: jest.fn(),
    moderateDocument: jest.fn(),
  }

  const mockAdminGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: UserManagementService,
          useValue: mockUserManagementService,
        },
        {
          provide: AdminDashboardService,
          useValue: mockAdminDashboardService,
        },
        {
          provide: AdminGuard,
          useValue: mockAdminGuard,
        },
      ],
    }).compile()

    controller = module.get<AdminController>(AdminController)
    userManagementService = module.get<UserManagementService>(UserManagementService)
    adminDashboardService = module.get<AdminDashboardService>(AdminDashboardService)

    jest.clearAllMocks()
  })

  describe("getDashboard", () => {
    it("should return dashboard statistics", async () => {
      mockAdminDashboardService.getDashboardStats.mockResolvedValue(mockDashboardStats)

      const result = await controller.getDashboard()

      expect(adminDashboardService.getDashboardStats).toHaveBeenCalled()
      expect(result).toEqual(mockDashboardStats)
    })
  })

  describe("createUser", () => {
    it("should create a new user", async () => {
      const createUserDto: CreateUserDto = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        password: "password123",
        role: UserRole.USER,
      }

      mockUserManagementService.createUser.mockResolvedValue(mockUser)

      const result = await controller.createUser(createUserDto)

      expect(userManagementService.createUser).toHaveBeenCalledWith(createUserDto)
      expect(result).toEqual(mockUser)
    })
  })

  describe("getUsers", () => {
    it("should return paginated users", async () => {
      const query: UserQueryDto = {
        role: UserRole.USER,
        limit: 10,
        offset: 0,
      }

      const response = {
        users: [mockUser],
        total: 1,
        limit: 10,
        offset: 0,
      }

      mockUserManagementService.findAll.mockResolvedValue(response)

      const result = await controller.getUsers(query)

      expect(userManagementService.findAll).toHaveBeenCalledWith(query)
      expect(result).toEqual(response)
    })
  })

  describe("updateUser", () => {
    it("should update user", async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: "Jane",
        department: "HR",
      }

      const updatedUser = { ...mockUser, ...updateUserDto }
      mockUserManagementService.updateUser.mockResolvedValue(updatedUser)

      const result = await controller.updateUser("user-123", updateUserDto)

      expect(userManagementService.updateUser).toHaveBeenCalledWith("user-123", updateUserDto)
      expect(result).toEqual(updatedUser)
    })
  })

  describe("suspendUser", () => {
    it("should suspend user with reason", async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED }
      mockUserManagementService.suspendUser.mockResolvedValue(suspendedUser)

      const result = await controller.suspendUser("user-123", { reason: "Policy violation" })

      expect(userManagementService.suspendUser).toHaveBeenCalledWith("user-123", "Policy violation")
      expect(result).toEqual(suspendedUser)
    })
  })

  describe("resetPassword", () => {
    it("should reset user password", async () => {
      mockUserManagementService.resetPassword.mockResolvedValue(mockUser)

      const result = await controller.resetPassword("user-123", { password: "newpassword123" })

      expect(userManagementService.resetPassword).toHaveBeenCalledWith("user-123", "newpassword123")
      expect(result).toEqual({ message: "Password reset successfully" })
    })
  })

  describe("getFlaggedDocuments", () => {
    it("should return flagged documents", async () => {
      const flaggedDocs = {
        documents: [],
        total: 0,
        limit: 50,
        offset: 0,
      }

      mockAdminDashboardService.getFlaggedDocuments.mockResolvedValue(flaggedDocs)

      const result = await controller.getFlaggedDocuments({})

      expect(adminDashboardService.getFlaggedDocuments).toHaveBeenCalledWith({})
      expect(result).toEqual(flaggedDocs)
    })
  })

  describe("moderateDocument", () => {
    it("should moderate document", async () => {
      mockAdminDashboardService.moderateDocument.mockResolvedValue(undefined)

      const result = await controller.moderateDocument("doc-123", {
        action: "approve",
        moderatorId: "mod-123",
        comments: "Document looks good",
      })

      expect(adminDashboardService.moderateDocument).toHaveBeenCalledWith(
        "doc-123",
        "approve",
        "mod-123",
        "Document looks good",
      )
      expect(result).toEqual({ message: "Document approved successfully" })
    })
  })

  describe("bulkUpdateUsers", () => {
    it("should bulk update users", async () => {
      mockUserManagementService.bulkUpdateUsers.mockResolvedValue(5)

      const result = await controller.bulkUpdateUsers({
        userIds: ["user-1", "user-2", "user-3"],
        updateData: { status: UserStatus.ACTIVE },
      })

      expect(userManagementService.bulkUpdateUsers).toHaveBeenCalledWith(["user-1", "user-2", "user-3"], {
        status: UserStatus.ACTIVE,
      })
      expect(result).toEqual({ updatedCount: 5 })
    })
  })
})
