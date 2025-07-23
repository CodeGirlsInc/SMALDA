import { Test, type TestingModule } from "@nestjs/testing"
import { Reflector } from "@nestjs/core"
import type { ExecutionContext } from "@nestjs/common"
import { PermissionsGuard } from "../guards/permissions.guard"
import { PermissionsService } from "../services/permissions.service"
import { PermissionAction, PermissionResource } from "../entities/permission.entity"
import type { RequiredPermission } from "../decorators/permissions.decorator"
import { jest } from "@jest/globals"

describe("PermissionsGuard", () => {
  let guard: PermissionsGuard
  let reflector: Reflector
  let permissionsService: PermissionsService

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  }

  const mockPermissionsService = {
    hasPermission: jest.fn(),
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
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile()

    guard = module.get<PermissionsGuard>(PermissionsGuard)
    reflector = module.get<Reflector>(Reflector)
    permissionsService = module.get<PermissionsService>(PermissionsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(guard).toBeDefined()
  })

  it("should allow access when no permissions are required", async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(true)
  })

  it("should deny access when user is not authenticated", async () => {
    const requiredPermissions: RequiredPermission[] = [
      { action: PermissionAction.READ, resource: PermissionResource.USER },
    ]
    mockReflector.getAllAndOverride.mockReturnValue(requiredPermissions)

    const mockRequest = { user: null }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(false)
  })

  it("should allow access when user has all required permissions", async () => {
    const requiredPermissions: RequiredPermission[] = [
      { action: PermissionAction.READ, resource: PermissionResource.USER },
      { action: PermissionAction.UPDATE, resource: PermissionResource.USER },
    ]
    mockReflector.getAllAndOverride.mockReturnValue(requiredPermissions)

    const mockRequest = { user: { id: "user-1" } }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    mockPermissionsService.hasPermission.mockResolvedValue(true)

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(true)
    expect(mockPermissionsService.hasPermission).toHaveBeenCalledTimes(2)
    expect(mockPermissionsService.hasPermission).toHaveBeenCalledWith(
      "user-1",
      PermissionAction.READ,
      PermissionResource.USER,
    )
    expect(mockPermissionsService.hasPermission).toHaveBeenCalledWith(
      "user-1",
      PermissionAction.UPDATE,
      PermissionResource.USER,
    )
  })

  it("should deny access when user lacks one required permission", async () => {
    const requiredPermissions: RequiredPermission[] = [
      { action: PermissionAction.READ, resource: PermissionResource.USER },
      { action: PermissionAction.DELETE, resource: PermissionResource.USER },
    ]
    mockReflector.getAllAndOverride.mockReturnValue(requiredPermissions)

    const mockRequest = { user: { id: "user-1" } }
    mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest)

    mockPermissionsService.hasPermission
      .mockResolvedValueOnce(true) // First permission check passes
      .mockResolvedValueOnce(false) // Second permission check fails

    const result = await guard.canActivate(mockExecutionContext)

    expect(result).toBe(false)
    expect(mockPermissionsService.hasPermission).toHaveBeenCalledTimes(2)
  })
})
