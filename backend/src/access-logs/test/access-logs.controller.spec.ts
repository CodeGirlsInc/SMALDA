import { Test, type TestingModule } from "@nestjs/testing"
import { AccessLogsController } from "../access-logs.controller"
import { AccessLogsService } from "../access-logs.service"
import type { FilterAccessLogsDto } from "../dto/filter-access-logs.dto"
import type { AccessLog } from "../entities/access-log.entity"
import { jest } from "@jest/globals"

describe("AccessLogsController", () => {
  let controller: AccessLogsController
  let service: AccessLogsService

  const mockAccessLog: AccessLog = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    routePath: "/api/users",
    httpMethod: "GET",
    ipAddress: "192.168.1.1",
    userId: "user-123",
    userAgent: "Mozilla/5.0",
    statusCode: 200,
    responseTime: 150,
    createdAt: new Date(),
  }

  const mockService = {
    findAll: jest.fn(),
    findByUser: jest.fn(),
    getAccessLogStats: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessLogsController],
      providers: [
        {
          provide: AccessLogsService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<AccessLogsController>(AccessLogsController)
    service = module.get<AccessLogsService>(AccessLogsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("findAll", () => {
    it("should return paginated access logs", async () => {
      const filterDto: FilterAccessLogsDto = {
        page: 1,
        limit: 10,
        userId: "user-123",
      }

      const expectedResult = {
        data: [mockAccessLog],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }

      mockService.findAll.mockResolvedValue(expectedResult)

      const result = await controller.findAll(filterDto)

      expect(result).toEqual(expectedResult)
      expect(service.findAll).toHaveBeenCalledWith(filterDto)
    })
  })

  describe("getStats", () => {
    it("should return access log statistics", async () => {
      const userId = "user-123"
      const expectedStats = {
        totalRequests: 100,
        uniqueIPs: 5,
        topRoutes: [{ routePath: "/api/users", count: 50 }],
      }

      mockService.getAccessLogStats.mockResolvedValue(expectedStats)

      const result = await controller.getStats(userId)

      expect(result).toEqual(expectedStats)
      expect(service.getAccessLogStats).toHaveBeenCalledWith(userId)
    })
  })

  describe("findByUser", () => {
    it("should return access logs for a specific user", async () => {
      const userId = "user-123"
      const limit = 50

      mockService.findByUser.mockResolvedValue([mockAccessLog])

      const result = await controller.findByUser(userId, limit)

      expect(result).toEqual([mockAccessLog])
      expect(service.findByUser).toHaveBeenCalledWith(userId, limit)
    })
  })
})
