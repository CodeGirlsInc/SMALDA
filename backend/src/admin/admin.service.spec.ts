import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { UserManagementService } from "./services/user-management.service"
import { User, UserRole, UserStatus } from "./entities/user.entity"
import type { CreateUserDto } from "./dto/create-user.dto"
import type { UpdateUserDto } from "./dto/update-user.dto"
import type { UserQueryDto } from "./dto/admin-query.dto"
import * as bcrypt from "bcrypt"
import { jest } from "@jest/globals"

// Mock bcrypt
jest.mock("bcrypt")
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

describe("UserManagementService", () => {
  let service: UserManagementService
  let repository: Repository<User>

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

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserManagementService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<UserManagementService>(UserManagementService)
    repository = module.get<Repository<User>>(getRepositoryToken(User))

    jest.clearAllMocks()
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
    mockedBcrypt.hash.mockResolvedValue("hashedpassword" as never)
  })

  describe("createUser", () => {
    const createUserDto: CreateUserDto = {
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      password: "password123",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      department: "IT",
    }

    it("should create a user successfully", async () => {
      mockRepository.findOne.mockResolvedValue(null) // No existing user
      mockRepository.create.mockReturnValue(mockUser)
      mockRepository.save.mockResolvedValue(mockUser)

      const result = await service.createUser(createUserDto)

      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12)
      expect(repository.create).toHaveBeenCalled()
      expect(repository.save).toHaveBeenCalledWith(mockUser)
      expect(result).toEqual(mockUser)
    })

    it("should throw ConflictException if user already exists", async () => {
      mockRepository.findOne.mockResolvedValue(mockUser)

      await expect(service.createUser(createUserDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("findAll", () => {
    it("should return paginated users", async () => {
      const query: UserQueryDto = {
        role: UserRole.USER,
        limit: 10,
        offset: 0,
      }

      const users = [mockUser]
      mockQueryBuilder.getManyAndCount.mockResolvedValue([users, 1])

      const result = await service.findAll(query)

      expect(repository.createQueryBuilder).toHaveBeenCalledWith("user")
      expect(result).toEqual({
        users,
        total: 1,
        limit: 10,
        offset: 0,
      })
    })

    it("should handle search query", async () => {
      const query: UserQueryDto = {
        search: "john",
        limit: 50,
        offset: 0,
      }

      const users = [mockUser]
      mockQueryBuilder.getManyAndCount.mockResolvedValue([users, 1])

      const result = await service.findAll(query)

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)",
        { search: "%john%" },
      )
      expect(result.users).toEqual(users)
    })
  })

  describe("findOne", () => {
    it("should return a user by id", async () => {
      mockRepository.findOne.mockResolvedValue(mockUser)

      const result = await service.findOne("user-123")

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: "user-123" },
      })
      expect(result).toEqual(mockUser)
    })

    it("should throw NotFoundException if user not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("non-existent")).rejects.toThrow(NotFoundException)
    })
  })

  describe("updateUser", () => {
    const updateUserDto: UpdateUserDto = {
      firstName: "Jane",
      department: "HR",
    }

    it("should update user successfully", async () => {
      const updatedUser = { ...mockUser, ...updateUserDto }
      mockRepository.findOne.mockResolvedValue(mockUser)
      mockRepository.save.mockResolvedValue(updatedUser)

      const result = await service.updateUser("user-123", updateUserDto)

      expect(repository.save).toHaveBeenCalled()
      expect(result.firstName).toBe("Jane")
      expect(result.department).toBe("HR")
    })

    it("should check email uniqueness when updating email", async () => {
      const updateDto = { email: "newemail@example.com" }
      mockRepository.findOne
        .mockResolvedValueOnce(mockUser) // For findOne(id)
        .mockResolvedValueOnce(null) // For email uniqueness check

      await service.updateUser("user-123", updateDto)

      expect(repository.findOne).toHaveBeenCalledTimes(2)
    })

    it("should throw ConflictException if email already exists", async () => {
      const updateDto = { email: "existing@example.com" }
      const existingUser = { ...mockUser, id: "other-user", email: "existing@example.com" }

      mockRepository.findOne
        .mockResolvedValueOnce(mockUser) // For findOne(id)
        .mockResolvedValueOnce(existingUser) // For email uniqueness check

      await expect(service.updateUser("user-123", updateDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("suspendUser", () => {
    it("should suspend user with reason", async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED }
      mockRepository.findOne.mockResolvedValue(mockUser)
      mockRepository.save.mockResolvedValue(suspendedUser)

      const result = await service.suspendUser("user-123", "Policy violation")

      expect(result.status).toBe(UserStatus.SUSPENDED)
      expect(result.metadata.suspensionReason).toBe("Policy violation")
    })
  })

  describe("activateUser", () => {
    it("should activate suspended user", async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED }
      const activatedUser = { ...mockUser, status: UserStatus.ACTIVE }

      mockRepository.findOne.mockResolvedValue(suspendedUser)
      mockRepository.save.mockResolvedValue(activatedUser)

      const result = await service.activateUser("user-123")

      expect(result.status).toBe(UserStatus.ACTIVE)
      expect(result.lockedUntil).toBeNull()
      expect(result.loginAttempts).toBe(0)
    })
  })

  describe("lockUser", () => {
    it("should lock user for specified duration", async () => {
      const lockedUser = { ...mockUser, lockedUntil: new Date() }
      mockRepository.findOne.mockResolvedValue(mockUser)
      mockRepository.save.mockResolvedValue(lockedUser)

      const result = await service.lockUser("user-123", 24)

      expect(result.lockedUntil).toBeDefined()
      expect(result.metadata.lockDurationHours).toBe(24)
    })
  })

  describe("resetPassword", () => {
    it("should reset user password", async () => {
      const updatedUser = { ...mockUser }
      mockRepository.findOne.mockResolvedValue(mockUser)
      mockRepository.save.mockResolvedValue(updatedUser)

      const result = await service.resetPassword("user-123", "newpassword123")

      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 12)
      expect(result.metadata.passwordResetAt).toBeDefined()
    })

    it("should throw BadRequestException for short password", async () => {
      mockRepository.findOne.mockResolvedValue(mockUser)

      await expect(service.resetPassword("user-123", "short")).rejects.toThrow()
    })
  })

  describe("getUserStats", () => {
    it("should return user statistics", async () => {
      const users = [
        mockUser,
        { ...mockUser, id: "user-2", status: UserStatus.INACTIVE, role: UserRole.ADMIN },
        { ...mockUser, id: "user-3", status: UserStatus.SUSPENDED },
      ]
      mockRepository.find.mockResolvedValue(users)

      const result = await service.getUserStats()

      expect(result.total).toBe(3)
      expect(result.active).toBe(2)
      expect(result.inactive).toBe(1)
      expect(result.suspended).toBe(1)
      expect(result.byRole[UserRole.USER]).toBe(2)
      expect(result.byRole[UserRole.ADMIN]).toBe(1)
    })
  })
})
