import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { PermissionsService } from "../services/permissions.service"
import { Permission, PermissionAction, PermissionResource } from "../entities/permission.entity"
import { RolePermission } from "../entities/role-permission.entity"
import { Role, RoleType } from "../entities/role.entity"
import type { CreatePermissionDto } from "../dto/create-permission.dto"
import { jest } from "@jest/globals" // Import jest to declare it

describe("PermissionsService", () => {
  let service: PermissionsService
  let permissionRepository: Repository<Permission>
  let rolePermissionRepository: Repository<RolePermission>
  let roleRepository: Repository<Role>

  const mockPermissionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  }

  const mockRolePermissionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockRoleRepository = {
    findOne: jest.fn(),
  }

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(Permission),
          useValue: mockPermissionRepository,
        },
        {
          provide: getRepositoryToken(RolePermission),
          useValue: mockRolePermissionRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile()

    service = module.get<PermissionsService>(PermissionsService)
    permissionRepository = module.get<Repository<Permission>>(getRepositoryToken(Permission))
    rolePermissionRepository = module.get<Repository<RolePermission>>(getRepositoryToken(RolePermission))
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createPermission", () => {
    it("should create a new permission successfully", async () => {
      const createPermissionDto: CreatePermissionDto = {
        action: PermissionAction.READ,
        resource: PermissionResource.USER,
        description: "Read user permission",
      }

      const mockPermission = {
        id: "1",
        ...createPermissionDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPermissionRepository.findOne.mockResolvedValue(null)
      mockPermissionRepository.create.mockReturnValue(mockPermission)
      mockPermissionRepository.save.mockResolvedValue(mockPermission)

      const result = await service.createPermission(createPermissionDto)

      expect(mockPermissionRepository.findOne).toHaveBeenCalledWith({
        where: {
          action: createPermissionDto.action,
          resource: createPermissionDto.resource,
        },
      })
      expect(result).toEqual(mockPermission)
    })

    it("should throw ConflictException if permission already exists", async () => {
      const createPermissionDto: CreatePermissionDto = {
        action: PermissionAction.READ,
        resource: PermissionResource.USER,
      }

      const existingPermission = { id: "1" }
      mockPermissionRepository.findOne.mockResolvedValue(existingPermission)

      await expect(service.createPermission(createPermissionDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("assignPermissionToRole", () => {
    it("should assign permission to role successfully", async () => {
      const roleName = RoleType.ADMIN
      const permissionId = "permission-1"

      const mockRole = { id: "role-1", name: roleName, isActive: true }
      const mockPermission = { id: permissionId, isActive: true }
      const mockRolePermission = {
        id: "role-permission-1",
        role: mockRole,
        permission: mockPermission,
      }

      mockRoleRepository.findOne.mockResolvedValue(mockRole)
      mockPermissionRepository.findOne.mockResolvedValue(mockPermission)
      mockRolePermissionRepository.findOne.mockResolvedValue(null)
      mockRolePermissionRepository.create.mockReturnValue(mockRolePermission)
      mockRolePermissionRepository.save.mockResolvedValue(mockRolePermission)

      const result = await service.assignPermissionToRole(roleName, permissionId)

      expect(result).toEqual(mockRolePermission)
    })

    it("should throw NotFoundException if role not found", async () => {
      const roleName = RoleType.ADMIN
      const permissionId = "permission-1"

      mockRoleRepository.findOne.mockResolvedValue(null)

      await expect(service.assignPermissionToRole(roleName, permissionId)).rejects.toThrow(NotFoundException)
    })
  })

  describe("hasPermission", () => {
    it("should return true if user has permission", async () => {
      const userId = "user-1"
      const action = PermissionAction.READ
      const resource = PermissionResource.USER

      mockRolePermissionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getOne.mockResolvedValue({ id: "role-permission-1" })

      const result = await service.hasPermission(userId, action, resource)

      expect(result).toBe(true)
      expect(mockRolePermissionRepository.createQueryBuilder).toHaveBeenCalledWith("rp")
    })

    it("should return false if user does not have permission", async () => {
      const userId = "user-1"
      const action = PermissionAction.READ
      const resource = PermissionResource.USER

      mockRolePermissionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getOne.mockResolvedValue(null)

      const result = await service.hasPermission(userId, action, resource)

      expect(result).toBe(false)
    })
  })

  describe("getUserPermissions", () => {
    it("should return user permissions", async () => {
      const userId = "user-1"
      const mockPermission = {
        id: "permission-1",
        action: PermissionAction.READ,
        resource: PermissionResource.USER,
      }

      const mockRolePermissions = [
        {
          id: "role-permission-1",
          permission: mockPermission,
        },
      ]

      mockRolePermissionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getMany.mockResolvedValue(mockRolePermissions)

      const result = await service.getUserPermissions(userId)

      expect(result).toEqual([mockPermission])
    })
  })
})
