import { Test, type TestingModule } from "@nestjs/testing"
import type { Response } from "express"
import { AccessLogMiddleware, type RequestWithUser } from "../middleware/access-log.middleware"
import { AccessLogsService } from "../access-logs.service"
import { jest } from "@jest/globals"

describe("AccessLogMiddleware", () => {
  let middleware: AccessLogMiddleware
  let service: AccessLogsService

  const mockService = {
    create: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessLogMiddleware,
        {
          provide: AccessLogsService,
          useValue: mockService,
        },
      ],
    }).compile()

    middleware = module.get<AccessLogMiddleware>(AccessLogMiddleware)
    service = module.get<AccessLogsService>(AccessLogsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should log access when response finishes", async () => {
    const mockRequest = {
      originalUrl: "/api/users",
      url: "/api/users",
      method: "GET",
      user: { id: "user-123" },
      headers: {
        "user-agent": "Mozilla/5.0",
      },
      get: jest.fn().mockReturnValue("Mozilla/5.0"),
      connection: { remoteAddress: "192.168.1.1" },
      socket: {},
    } as unknown as RequestWithUser

    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    } as unknown as Response

    const mockNext = jest.fn()

    // Mock the 'finish' event
    const finishCallback = jest.fn()
    ;(mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === "finish") {
        finishCallback.mockImplementation(callback)
      }
    })

    mockService.create.mockResolvedValue({})

    middleware.use(mockRequest, mockResponse, mockNext)

    expect(mockNext).toHaveBeenCalled()

    // Simulate response finish
    await finishCallback()

    expect(service.create).toHaveBeenCalledWith({
      routePath: "/api/users",
      httpMethod: "GET",
      ipAddress: "192.168.1.1",
      userId: "user-123",
      userAgent: "Mozilla/5.0",
      statusCode: 200,
      responseTime: expect.any(Number),
    })
  })

  it("should handle requests without authenticated user", async () => {
    const mockRequest = {
      originalUrl: "/api/public",
      method: "GET",
      headers: {},
      get: jest.fn().mockReturnValue(undefined),
      connection: { remoteAddress: "192.168.1.1" },
      socket: {},
    } as unknown as RequestWithUser

    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    } as unknown as Response

    const mockNext = jest.fn()

    const finishCallback = jest.fn()
    ;(mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === "finish") {
        finishCallback.mockImplementation(callback)
      }
    })

    mockService.create.mockResolvedValue({})

    middleware.use(mockRequest, mockResponse, mockNext)

    await finishCallback()

    expect(service.create).toHaveBeenCalledWith({
      routePath: "/api/public",
      httpMethod: "GET",
      ipAddress: "192.168.1.1",
      userId: undefined,
      userAgent: undefined,
      statusCode: 200,
      responseTime: expect.any(Number),
    })
  })

  it("should extract IP from x-forwarded-for header", async () => {
    const mockRequest = {
      originalUrl: "/api/test",
      method: "GET",
      headers: {
        "x-forwarded-for": "203.0.113.1, 192.168.1.1",
      },
      get: jest.fn().mockReturnValue(undefined),
      connection: { remoteAddress: "10.0.0.1" },
      socket: {},
    } as unknown as RequestWithUser

    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    } as unknown as Response

    const mockNext = jest.fn()

    const finishCallback = jest.fn()
    ;(mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === "finish") {
        finishCallback.mockImplementation(callback)
      }
    })

    mockService.create.mockResolvedValue({})

    middleware.use(mockRequest, mockResponse, mockNext)

    await finishCallback()

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: "203.0.113.1", // Should use the first IP from x-forwarded-for
      }),
    )
  })

  it("should handle service errors gracefully", async () => {
    const mockRequest = {
      originalUrl: "/api/test",
      method: "GET",
      headers: {},
      get: jest.fn().mockReturnValue(undefined),
      connection: { remoteAddress: "192.168.1.1" },
      socket: {},
    } as unknown as RequestWithUser

    const mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    } as unknown as Response

    const mockNext = jest.fn()

    const finishCallback = jest.fn()
    ;(mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === "finish") {
        finishCallback.mockImplementation(callback)
      }
    })

    mockService.create.mockRejectedValue(new Error("Database error"))

    middleware.use(mockRequest, mockResponse, mockNext)

    // Should not throw error even if service fails
    await expect(finishCallback()).resolves.toBeUndefined()
    expect(mockNext).toHaveBeenCalled()
  })
})
