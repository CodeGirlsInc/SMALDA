import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { type Repository, Between } from "typeorm"
import { AccessLogsService } from "../access-logs.service"
import { AccessLog } from "../entities/access-log.entity"
import type { CreateAccessLogDto } from "../dto/create-access-log.dto"
import type { FilterAccessLogsDto } from "../dto/filter-access-logs.dto"
import { jest } from "@jest/globals" // Import jest to declare it

describe("AccessLogsService", () => {
  let service: AccessLogsService
  let repository: Repository<AccessLog>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessLogsService,
        {
          provide: getRepositoryToken(AccessLog),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<AccessLogsService>(AccessLogsService)
    repository = module.get<Repository<AccessLog>>(getRepositoryToken(AccessLog))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create and save an access log", async () => {
      const createDto: CreateAccessLogDto = {
        routePath: "/api/users",
        httpMethod: "GET",
        ipAddress: "192.168.1.1",
        userId: "user-123",
        userAgent: "Mozilla/5.0",
        statusCode: 200,
        responseTime: 150,
      }

      mockRepository.create.mockReturnValue(mockAccessLog)
      mockRepository.save.mockResolvedValue(mockAccessLog)

      const result = await service.create(createDto)

      expect(mockRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockRepository.save).toHaveBeenCalledWith(mockAccessLog)
      expect(result).toEqual(mockAccessLog)
    })

    it("should handle creation errors", async () => {
      const createDto: CreateAccessLogDto = {
        routePath: "/api/users",
        httpMethod: "GET",
        ipAddress: "192.168.1.1",
      }

      const error = new Error("Database error")
      mockRepository.create.mockReturnValue(mockAccessLog)
      mockRepository.save.mockRejectedValue(error)

      await expect(service.create(createDto)).rejects.toThrow(error)
    })
  })

  describe("findAll", () => {
    it("should return paginated access logs with filters", async () => {
      const filterDto: FilterAccessLogsDto = {
        userId: "user-123",
        page: 1,
        limit: 10,
      }

      const mockData = [mockAccessLog]
      const mockTotal = 1

      mockRepository.findAndCount.mockResolvedValue([mockData, mockTotal])

      const result = await service.findAll(filterDto)

      expect(result).toEqual({
        data: mockData,
        total: mockTotal,
        page: 1,
        limit: 10,
        totalPages: 1,
      })

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        order: { createdAt: "DESC" },
        skip: 0,
        take: 10,
      })
    })

    it("should handle date range filters", async () => {
      const filterDto: FilterAccessLogsDto = {
        startDate: "2023-01-01",
        endDate: "2023-12-31",
        page: 1,
        limit: 10,
      }

      mockRepository.findAndCount.mockResolvedValue([[mockAccessLog], 1])

      await service.findAll(filterDto)

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          createdAt: Between(new Date("2023-01-01"), new Date("2023-12-31")),
        },
        order: { createdAt: "DESC" },
        skip: 0,
        take: 10,
      })
    })
  })

  describe("findByUser", () => {
    it("should find access logs by user ID", async () => {
      const userId = "user-123"
      const limit = 50

      mockRepository.find.mockResolvedValue([mockAccessLog])

      const result = await service.findByUser(userId, limit)

      expect(result).toEqual([mockAccessLog])
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: "DESC" },
        take: limit,
      })
    })
  })

  describe("findByTimeRange", () => {
    it("should find access logs by time range", async () => {
      const startDate = new Date("2023-01-01")
      const endDate = new Date("2023-12-31")

      mockRepository.find.mockResolvedValue([mockAccessLog])

      const result = await service.findByTimeRange(startDate, endDate)

      expect(result).toEqual([mockAccessLog])
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: "DESC" },
      })
    })
  })

  describe("getAccessLogStats", () => {
    it("should return access log statistics", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(100),
        getRawOne: jest.fn().mockResolvedValue({ count: "5" }),
        getRawMany: jest.fn().mockResolvedValue([
          { routePath: "/api/users", count: "50" },
          { routePath: "/api/posts", count: "30" },
        ]),
      }

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      const result = await service.getAccessLogStats("user-123")

      expect(result).toEqual({
        totalRequests: 100,
        uniqueIPs: 5,
        topRoutes: [
          { routePath: "/api/users", count: 50 },
          { routePath: "/api/posts", count: 30 },
        ],
      })
    })
  })
})
