import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AuditLogService } from "./audit-log.service"
import { AuditLog, AuditAction, AuditSeverity } from "./entities/audit-log.entity"
import type { CreateAuditLogDto } from "./dto/create-audit-log.dto"
import type { AuditLogQueryDto } from "./dto/audit-log-query.dto"
import type { AuditContext, AuditLogData } from "./interfaces/audit-context.interface"
import { jest } from "@jest/globals"

describe("AuditLogService", () => {
  let service: AuditLogService
  let repository: Repository<AuditLog>

  const mockAuditLog: AuditLog = {
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

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<AuditLogService>(AuditLogService)
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog))

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
        metadata: { fileName: "test.pdf" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        success: true,
      }

      mockRepository.create.mockReturnValue(mockAuditLog)
      mockRepository.save.mockResolvedValue(mockAuditLog)

      const result = await service.createLog(createDto)

      expect(repository.create).toHaveBeenCalledWith(createDto)
      expect(repository.save).toHaveBeenCalledWith(mockAuditLog)
      expect(result).toEqual(mockAuditLog)
    })
  })

  describe("log", () => {
    it("should create audit log from context and data", async () => {
      const context: AuditContext = {
        userId: "user-123",
        userEmail: "user@example.com",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      }

      const data: AuditLogData = {
        action: AuditAction.UPLOAD_DOCUMENT,
        severity: AuditSeverity.MEDIUM,
        description: "Document uploaded successfully",
        resourceType: "document",
        resourceId: "doc-123",
        metadata: { fileName: "test.pdf" },
        success: true,
      }

      mockRepository.create.mockReturnValue(mockAuditLog)
      mockRepository.save.mockResolvedValue(mockAuditLog)

      const result = await service.log(context, data)

      expect(repository.create).toHaveBeenCalled()
      expect(repository.save).toHaveBeenCalled()
      expect(result).toEqual(mockAuditLog)
    })
  })

  describe("findAll", () => {
    it("should return paginated audit logs", async () => {
      const query: AuditLogQueryDto = {
        limit: 10,
        offset: 0,
        userId: "user-123",
      }

      const logs = [mockAuditLog]
      mockRepository.findAndCount.mockResolvedValue([logs, 1])

      const result = await service.findAll(query)

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        order: { createdAt: "DESC" },
        take: 10,
        skip: 0,
      })
      expect(result).toEqual({
        logs,
        total: 1,
        limit: 10,
        offset: 0,
      })
    })

    it("should handle search query", async () => {
      const query: AuditLogQueryDto = {
        search: "upload",
        limit: 50,
        offset: 0,
      }

      const logs = [mockAuditLog]
      mockRepository.findAndCount.mockResolvedValue([logs, 1])

      const result = await service.findAll(query)

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { description: expect.objectContaining({}) },
        order: { createdAt: "DESC" },
        take: 50,
        skip: 0,
      })
      expect(result.logs).toEqual(logs)
    })
  })

  describe("findByUser", () => {
    it("should return audit logs for specific user", async () => {
      const logs = [mockAuditLog]
      mockRepository.find.mockResolvedValue(logs)

      const result = await service.findByUser("user-123")

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        order: { createdAt: "DESC" },
        take: 50,
        skip: 0,
      })
      expect(result).toEqual(logs)
    })
  })

  describe("findByResource", () => {
    it("should return audit logs for specific resource", async () => {
      const logs = [mockAuditLog]
      mockRepository.find.mockResolvedValue(logs)

      const result = await service.findByResource("document", "doc-123")

      expect(repository.find).toHaveBeenCalledWith({
        where: { resourceType: "document", resourceId: "doc-123" },
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(logs)
    })
  })

  describe("getAuditStatistics", () => {
    it("should return audit statistics", async () => {
      const logs = [
        mockAuditLog,
        {
          ...mockAuditLog,
          id: "audit-124",
          action: AuditAction.DELETE_DOCUMENT,
          severity: AuditSeverity.HIGH,
        },
      ]
      mockRepository.find.mockResolvedValue(logs)

      const result = await service.getAuditStatistics()

      expect(result.totalLogs).toBe(2)
      expect(result.actionCounts[AuditAction.UPLOAD_DOCUMENT]).toBe(1)
      expect(result.actionCounts[AuditAction.DELETE_DOCUMENT]).toBe(1)
      expect(result.severityCounts[AuditSeverity.MEDIUM]).toBe(1)
      expect(result.severityCounts[AuditSeverity.HIGH]).toBe(1)
    })
  })

  describe("findSuspiciousActivity", () => {
    it("should return high and critical severity logs", async () => {
      const suspiciousLogs = [
        { ...mockAuditLog, severity: AuditSeverity.HIGH },
        { ...mockAuditLog, severity: AuditSeverity.CRITICAL },
      ]
      mockRepository.find.mockResolvedValue(suspiciousLogs)

      const result = await service.findSuspiciousActivity()

      expect(repository.find).toHaveBeenCalledWith({
        where: { severity: expect.anything() },
        order: { createdAt: "DESC" },
        take: 100,
      })
      expect(result).toEqual(suspiciousLogs)
    })
  })

  describe("deleteOldLogs", () => {
    it("should delete logs older than specified days", async () => {
      mockRepository.delete.mockResolvedValue({ affected: 5 })

      const result = await service.deleteOldLogs(30)

      expect(repository.delete).toHaveBeenCalled()
      expect(result).toBe(5)
    })
  })
})
