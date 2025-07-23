import { Test, type TestingModule } from "@nestjs/testing"
import { AuditLogController } from "./audit-log.controller"
import { AuditLogService } from "./audit-log.service"
import { AuditAction, AuditSeverity } from "./entities/audit-log.entity"
import type { CreateAuditLogDto } from "./dto/create-audit-log.dto"
import type { AuditLogQueryDto } from "./dto/audit-log-query.dto"
import { jest } from "@jest/globals"

describe("AuditLogController", () => {
  let controller: AuditLogController
  let service: AuditLogService

  const mockAuditLog = {
    id: "audit-123",
    userId: "user-123",
    userEmail: "user@example.com",
    action: AuditAction.UPLOAD_DOCUMENT,
    severity: AuditSeverity.MEDIUM,
    description: "Document uploaded successfully",
    resourceType: "document",
    resourceId: "doc-123",
    metadata: { fileName: "test.pdf" },
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    success: true,
    errorMessage: null,
    createdAt: new Date(),
  }

  const mockAuditLogService = {
    createLog: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUser: jest.fn(),
    findByResource: jest.fn(),
    findByAction: jest.fn(),
    getAuditStatistics: jest.fn(),
    findSuspiciousActivity: jest.fn(),
    deleteOldLogs: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile()

    controller = module.get<AuditLogController>(AuditLogController)
    service = module.get<AuditLogService>(AuditLogService)

    jest.clearAllMocks()
  })

  describe("createLog", () => {
    it("should create an audit log", async () => {
      const createDto: CreateAuditLogDto = {
        userId: "user-123",
        userEmail: "user@example.com",
        action: AuditAction.UPLOAD_DOCUMENT,
        severity: AuditSeverity.MEDIUM,
        description: "Document uploaded successfully",
        resourceType: "document",
        resourceId: "doc-123",
      }

      mockAuditLogService.createLog.mockResolvedValue(mockAuditLog)

      const result = await controller.createLog(createDto)

      expect(service.createLog).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(mockAuditLog)
    })
  })

  describe("findAll", () => {
    it("should return paginated audit logs", async () => {
      const query: AuditLogQueryDto = {
        limit: 10,
        offset: 0,
      }

      const response = {
        logs: [mockAuditLog],
        total: 1,
        limit: 10,
        offset: 0,
      }

      mockAuditLogService.findAll.mockResolvedValue(response)

      const result = await controller.findAll(query)

      expect(service.findAll).toHaveBeenCalledWith(query)
      expect(result).toEqual(response)
    })
  })

  describe("getStatistics", () => {
    it("should return audit statistics", async () => {
      const stats = {
        totalLogs: 100,
        actionCounts: { UPLOAD_DOCUMENT: 50, DELETE_DOCUMENT: 25 },
        severityCounts: { LOW: 60, MEDIUM: 30, HIGH: 10 },
        userCounts: { "user-123": 75, "user-456": 25 },
        dailyCounts: { "2024-01-01": 50, "2024-01-02": 50 },
      }

      mockAuditLogService.getAuditStatistics.mockResolvedValue(stats)

      const result = await controller.getStatistics("2024-01-01", "2024-01-02")

      expect(service.getAuditStatistics).toHaveBeenCalledWith(new Date("2024-01-01"), new Date("2024-01-02"))
      expect(result).toEqual(stats)
    })
  })

  describe("findSuspiciousActivity", () => {
    it("should return suspicious activity logs", async () => {
      const suspiciousLogs = [
        { ...mockAuditLog, severity: AuditSeverity.HIGH },
        { ...mockAuditLog, severity: AuditSeverity.CRITICAL },
      ]

      mockAuditLogService.findSuspiciousActivity.mockResolvedValue(suspiciousLogs)

      const result = await controller.findSuspiciousActivity("user-123")

      expect(service.findSuspiciousActivity).toHaveBeenCalledWith("user-123")
      expect(result).toEqual(suspiciousLogs)
    })
  })

  describe("findByUser", () => {
    it("should return audit logs for specific user", async () => {
      const logs = [mockAuditLog]
      mockAuditLogService.findByUser.mockResolvedValue(logs)

      const result = await controller.findByUser("user-123", 10, 0)

      expect(service.findByUser).toHaveBeenCalledWith("user-123", 10, 0)
      expect(result).toEqual(logs)
    })
  })

  describe("findByResource", () => {
    it("should return audit logs for specific resource", async () => {
      const logs = [mockAuditLog]
      mockAuditLogService.findByResource.mockResolvedValue(logs)

      const result = await controller.findByResource("document", "doc-123")

      expect(service.findByResource).toHaveBeenCalledWith("document", "doc-123")
      expect(result).toEqual(logs)
    })
  })

  describe("findByAction", () => {
    it("should return audit logs for specific action", async () => {
      const logs = [mockAuditLog]
      mockAuditLogService.findByAction.mockResolvedValue(logs)

      const result = await controller.findByAction("UPLOAD_DOCUMENT", 10, 0)

      expect(service.findByAction).toHaveBeenCalledWith("UPLOAD_DOCUMENT", 10, 0)
      expect(result).toEqual(logs)
    })
  })

  describe("cleanupOldLogs", () => {
    it("should cleanup old logs", async () => {
      mockAuditLogService.deleteOldLogs.mockResolvedValue(25)

      const result = await controller.cleanupOldLogs(30)

      expect(service.deleteOldLogs).toHaveBeenCalledWith(30)
      expect(result).toEqual({ deletedCount: 25 })
    })
  })
})
