import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { RolesService } from "../services/roles.service"
import { Role, RoleType } from "../entities/role.entity"
import { UserRole } from "../entities/user-role.entity"
import type { CreateRoleDto } from "../dto/create-role.dto"
import type { AssignRoleDto } from "../dto/assign-role.dto"
import { jest } from "@jest/globals" // Import jest to declare it

describe("RolesService", () => {
  let service: RolesService
  let roleRepository: Repository<Role>
  let userRoleRepository: Repository<UserRole>

  const mockRoleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  }

  const mockUserRoleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
      ],
    }).compile()

    service = module.get<RolesService>(RolesService)
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role))
    userRoleRepository = module.get<Repository<UserRole>>(getRepositoryToken(UserRole))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createRole", () => {
    it("should create a new role successfully", async () => {
      const createRoleDto: CreateRoleDto = {
        name: RoleType.ADMIN,
        description: "Administrator role",
      }

      const mockRole = {
        id: "1",
        ...createRoleDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRoleRepository.findOne.mockResolvedValue(null)
      mockRoleRepository.create.mockReturnValue(mockRole)
      mockRoleRepository.save.mockResolvedValue(mockRole)

      const result = await service.createRole(createRoleDto)

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { name: createRoleDto.name },
      })
      expect(mockRoleRepository.create).toHaveBeenCalledWith(createRoleDto)
      expect(mockRoleRepository.save).toHaveBeenCalledWith(mockRole)
      expect(result).toEqual(mockRole)
    })

    it("should throw ConflictException if role already exists", async () => {
      const createRoleDto: CreateRoleDto = {
        name: RoleType.ADMIN,
        description: "Administrator role",
      }

      const existingRole = { id: "1", name: RoleType.ADMIN }
      mockRoleRepository.findOne.mockResolvedValue(existingRole)

      await expect(service.createRole(createRoleDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("findRoleByName", () => {
    it("should return role when found", async () => {
      const mockRole = {
        id: "1",
        name: RoleType.ADMIN,
        isActive: true,
        rolePermissions: [],
      }

      mockRoleRepository.findOne.mockResolvedValue(mockRole)

      const result = await service.findRoleByName(RoleType.ADMIN)

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { name: RoleType.ADMIN, isActive: true },
        relations: ["rolePermissions", "rolePermissions.permission"],
      })
      expect(result).toEqual(mockRole)
    })

    it("should throw NotFoundException when role not found", async () => {
      mockRoleRepository.findOne.mockResolvedValue(null)

      await expect(service.findRoleByName(RoleType.ADMIN)).rejects.toThrow(NotFoundException)
    })
  })

  describe("assignRoleToUser", () => {
    it("should assign role to user successfully", async () => {
      const assignRoleDto: AssignRoleDto = {
        userId: "user-1",
        roleName: RoleType.ADMIN,
      }

      const mockRole = { id: "role-1", name: RoleType.ADMIN }
      const mockUserRole = {
        id: "user-role-1",
        userId: assignRoleDto.userId,
        role: mockRole,
      }

      mockRoleRepository.findOne.mockResolvedValue(mockRole)
      mockUserRoleRepository.findOne.mockResolvedValue(null)
      mockUserRoleRepository.create.mockReturnValue(mockUserRole)
      mockUserRoleRepository.save.mockResolvedValue(mockUserRole)

      const result = await service.assignRoleToUser(assignRoleDto)

      expect(mockUserRoleRepository.create).toHaveBeenCalledWith({
        userId: assignRoleDto.userId,
        role: mockRole,
      })
      expect(result).toEqual(mockUserRole)
    })

    it("should throw ConflictException if user already has role", async () => {
      const assignRoleDto: AssignRoleDto = {
        userId: "user-1",
        roleName: RoleType.ADMIN,
      }

      const mockRole = { id: "role-1", name: RoleType.ADMIN }
      const existingUserRole = { id: "user-role-1" }

      mockRoleRepository.findOne.mockResolvedValue(mockRole)
      mockUserRoleRepository.findOne.mockResolvedValue(existingUserRole)

      await expect(service.assignRoleToUser(assignRoleDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("hasRole", () => {
    it("should return true if user has role", async () => {
      const userId = "user-1"
      const roleName = RoleType.ADMIN

      const mockUserRole = {
        id: "user-role-1",
        role: { name: roleName, isActive: true },
      }

      mockUserRoleRepository.findOne.mockResolvedValue(mockUserRole)

      const result = await service.hasRole(userId, roleName)

      expect(result).toBe(true)
    })

    it("should return false if user does not have role", async () => {
      const userId = "user-1"
      const roleName = RoleType.ADMIN

      mockUserRoleRepository.findOne.mockResolvedValue(null)

      const result = await service.hasRole(userId, roleName)

      expect(result).toBe(false)
    })
  })
})
