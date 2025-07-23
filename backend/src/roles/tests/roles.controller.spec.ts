import { Test, type TestingModule } from "@nestjs/testing"
import { RolesController } from "../controllers/roles.controller"
import { RolesService } from "../services/roles.service"
import type { CreateRoleDto } from "../dto/create-role.dto"
import type { AssignRoleDto } from "../dto/assign-role.dto"
import { RoleType } from "../entities/role.entity"
import { jest } from "@jest/globals"

describe("RolesController", () => {
  let controller: RolesController
  let service: RolesService

  const mockRolesService = {
    createRole: jest.fn(),
    findAllRoles: jest.fn(),
    findRoleByName: jest.fn(),
    assignRoleToUser: jest.fn(),
    removeRoleFromUser: jest.fn(),
    getUserRoles: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    }).compile()

    controller = module.get<RolesController>(RolesController)
    service = module.get<RolesService>(RolesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  describe("create", () => {
    it("should create a role", async () => {
      const createRoleDto: CreateRoleDto = {
        name: RoleType.ADMIN,
        description: "Administrator role",
      }

      const mockRole = { id: "1", ...createRoleDto }
      mockRolesService.createRole.mockResolvedValue(mockRole)

      const result = await controller.create(createRoleDto)

      expect(service.createRole).toHaveBeenCalledWith(createRoleDto)
      expect(result).toEqual(mockRole)
    })
  })

  describe("findAll", () => {
    it("should return all roles", async () => {
      const mockRoles = [
        { id: "1", name: RoleType.ADMIN },
        { id: "2", name: RoleType.USER },
      ]
      mockRolesService.findAllRoles.mockResolvedValue(mockRoles)

      const result = await controller.findAll()

      expect(service.findAllRoles).toHaveBeenCalled()
      expect(result).toEqual(mockRoles)
    })
  })

  describe("findOne", () => {
    it("should return a role by name", async () => {
      const roleName = RoleType.ADMIN
      const mockRole = { id: "1", name: roleName }
      mockRolesService.findRoleByName.mockResolvedValue(mockRole)

      const result = await controller.findOne(roleName)

      expect(service.findRoleByName).toHaveBeenCalledWith(roleName)
      expect(result).toEqual(mockRole)
    })
  })

  describe("assignRole", () => {
    it("should assign role to user", async () => {
      const assignRoleDto: AssignRoleDto = {
        userId: "user-1",
        roleName: RoleType.ADMIN,
      }

      const mockUserRole = { id: "1", ...assignRoleDto }
      mockRolesService.assignRoleToUser.mockResolvedValue(mockUserRole)

      const result = await controller.assignRole(assignRoleDto)

      expect(service.assignRoleToUser).toHaveBeenCalledWith(assignRoleDto)
      expect(result).toEqual(mockUserRole)
    })
  })

  describe("removeRole", () => {
    it("should remove role from user", async () => {
      const userId = "user-1"
      const roleName = RoleType.ADMIN

      mockRolesService.removeRoleFromUser.mockResolvedValue(undefined)

      const result = await controller.removeRole(userId, roleName)

      expect(service.removeRoleFromUser).toHaveBeenCalledWith(userId, roleName)
      expect(result).toBeUndefined()
    })
  })

  describe("getUserRoles", () => {
    it("should return user roles", async () => {
      const userId = "user-1"
      const mockRoles = [{ id: "1", name: RoleType.ADMIN }]
      mockRolesService.getUserRoles.mockResolvedValue(mockRoles)

      const result = await controller.getUserRoles(userId)

      expect(service.getUserRoles).toHaveBeenCalledWith(userId)
      expect(result).toEqual(mockRoles)
    })
  })
})
