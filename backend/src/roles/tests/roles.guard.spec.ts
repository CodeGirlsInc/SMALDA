import { Test, type TestingModule } from "@nestjs/testing"
import { Reflector } from "@nestjs/core"
import type { ExecutionContext } from "@nestjs/common"
import { RolesGuard } from "../guards/roles.guard"
import { RolesService } from "../services/roles.service"
import { RoleType } from "../entities/role.entity"
import { jest } from "@jest/globals"

describe("RolesGuard", () => {
  let guard: RolesGuard
  let reflector: Reflector
  let rolesService: RolesService

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  }

  const mockRolesService = {
    getUserRoles: jest.fn(),
  }

  const mockExecutionContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(),
    }),
  } as unknown as ExecutionContext

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    }).compile()

    guard = module.get<RolesGuard>(RolesGuard)
    reflector = module.get<Reflector>(Reflector)
    rolesService = module.get<RolesService>(RolesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(guard).toBeDefined()
  })

  it("should allow access when no roles are required", async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(true)
  })

  it("should deny access when user is not authenticated", async () => {
    mockReflector.getAllAndOverride.mockReturnValue([RoleType.ADMIN])

    const mockRequest = { user: null }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(false)
  })

  it("should allow access when user has required role", async () => {
    mockReflector.getAllAndOverride.mockReturnValue([RoleType.ADMIN])

    const mockRequest = { user: { id: "user-1" } }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    const mockUserRoles = [{ id: "role-1", name: RoleType.ADMIN }]
    mockRolesService.getUserRoles.mockResolvedValue(mockUserRoles)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(true)
    expect(mockRolesService.getUserRoles).toHaveBeenCalledWith("user-1")
  })

  it("should deny access when user does not have required role", async () => {
    mockReflector.getAllAndOverride.mockReturnValue([RoleType.ADMIN])

    const mockRequest = { user: { id: "user-1" } }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    const mockUserRoles = [{ id: "role-1", name: RoleType.USER }]
    mockRolesService.getUserRoles.mockResolvedValue(mockUserRoles)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(false)
  })

  it("should allow access when user has one of multiple required roles", async () => {
    mockReflector.getAllAndOverride.mockReturnValue([RoleType.ADMIN, RoleType.ANALYST])

    const mockRequest = { user: { id: "user-1" } }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    const mockUserRoles = [{ id: "role-1", name: RoleType.ANALYST }]
    mockRolesService.getUserRoles.mockResolvedValue(mockUserRoles)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(true)
  })
})
