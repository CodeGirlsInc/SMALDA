import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { NotificationService } from "./notification.service"
import { Notification, NotificationStatus, NotificationType, NotificationEvent } from "./entities/notification.entity"
import type { CreateNotificationDto } from "./dto/create-notification.dto"
import type { NotificationQueryDto } from "./dto/notification-query.dto"
import type { NotificationData } from "./interfaces/notification-template.interface"
import { jest } from "@jest/globals"

describe("NotificationService", () => {
  let service: NotificationService
  let repository: Repository<Notification>
  let queue: Queue

  const mockNotification: Notification = {
    id: "notification-123",
    recipientId: "user-123",
    recipientEmail: "user@example.com",
    type: NotificationType.EMAIL,
    event: NotificationEvent.RISK_DETECTED,
    status: NotificationStatus.PENDING,
    priority: "MEDIUM" as any,
    title: "Risk Detected",
    message: "Risk detected in document",
    data: { documentName: "test.pdf" },
    resourceType: "document",
    resourceId: "doc-123",
    senderId: "system",
    senderEmail: "system@example.com",
    templateId: "risk-detected",
    scheduledAt: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    errorMessage: null,
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    delete: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("notification"),
          useValue: mockQueue,
        },
      ],
    }).compile()

    service = module.get<NotificationService>(NotificationService)
    repository = module.get<Repository<Notification>>(getRepositoryToken(Notification))
    queue = module.get<Queue>(getQueueToken("notification"))

    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create a notification", async () => {
      const createDto: CreateNotificationDto = {
        recipientId: "user-123",
        recipientEmail: "user@example.com",
        type: NotificationType.EMAIL,
        event: NotificationEvent.RISK_DETECTED,
        title: "Risk Detected",
        message: "Risk detected in document",
        data: { documentName: "test.pdf" },
      }

      mockRepository.create.mockReturnValue(mockNotification)
      mockRepository.save.mockResolvedValue(mockNotification)

      const result = await service.create(createDto)

      expect(repository.create).toHaveBeenCalledWith(createDto)
      expect(repository.save).toHaveBeenCalledWith(mockNotification)
      expect(result).toEqual(mockNotification)
    })
  })

  describe("sendNotification", () => {
    it("should queue notification for processing", async () => {
      const notificationData: NotificationData = {
        recipientId: "user-123",
        recipientEmail: "user@example.com",
        event: NotificationEvent.RISK_DETECTED,
        data: { documentName: "test.pdf" },
      }

      mockQueue.add.mockResolvedValue({})

      await service.sendNotification(notificationData)

      expect(queue.add).toHaveBeenCalledWith(
        "send-notification",
        notificationData,
        expect.objectContaining({
          priority: expect.any(Number),
          attempts: 3,
          backoff: expect.any(Object),
        }),
      )
    })
  })

  describe("findAll", () => {
    it("should return paginated notifications", async () => {
      const query: NotificationQueryDto = {
        recipientId: "user-123",
        limit: 10,
        offset: 0,
      }

      const notifications = [mockNotification]
      mockRepository.findAndCount.mockResolvedValue([notifications, 1])

      const result = await service.findAll(query)

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { recipientId: "user-123" },
        order: { createdAt: "DESC" },
        take: 10,
        skip: 0,
      })
      expect(result).toEqual({
        notifications,
        total: 1,
        limit: 10,
        offset: 0,
      })
    })

    it("should handle date range filtering", async () => {
      const query: NotificationQueryDto = {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        limit: 50,
        offset: 0,
      }

      const notifications = [mockNotification]
      mockRepository.findAndCount.mockResolvedValue([notifications, 1])

      const result = await service.findAll(query)

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { createdAt: expect.anything() },
        order: { createdAt: "DESC" },
        take: 50,
        skip: 0,
      })
      expect(result.notifications).toEqual(notifications)
    })
  })

  describe("findByRecipient", () => {
    it("should return notifications for specific recipient", async () => {
      const notifications = [mockNotification]
      mockRepository.find.mockResolvedValue(notifications)

      const result = await service.findByRecipient("user-123")

      expect(repository.find).toHaveBeenCalledWith({
        where: { recipientId: "user-123" },
        order: { createdAt: "DESC" },
        take: 50,
        skip: 0,
      })
      expect(result).toEqual(notifications)
    })
  })

  describe("findUnreadByRecipient", () => {
    it("should return unread notifications for recipient", async () => {
      const notifications = [mockNotification]
      mockRepository.find.mockResolvedValue(notifications)

      const result = await service.findUnreadByRecipient("user-123")

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          recipientId: "user-123",
          status: expect.anything(),
        },
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(notifications)
    })
  })

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      mockRepository.update.mockResolvedValue({})

      await service.markAsRead("notification-123")

      expect(repository.update).toHaveBeenCalledWith("notification-123", {
        status: NotificationStatus.READ,
        readAt: expect.any(Date),
      })
    })
  })

  describe("markAllAsRead", () => {
    it("should mark all notifications as read for recipient", async () => {
      mockRepository.update.mockResolvedValue({})

      await service.markAllAsRead("user-123")

      expect(repository.update).toHaveBeenCalledWith(
        {
          recipientId: "user-123",
          status: expect.anything(),
        },
        {
          status: NotificationStatus.READ,
          readAt: expect.any(Date),
        },
      )
    })
  })

  describe("getNotificationStats", () => {
    it("should return notification statistics", async () => {
      const notifications = [
        mockNotification,
        { ...mockNotification, id: "notification-124", status: NotificationStatus.READ },
      ]
      mockRepository.find.mockResolvedValue(notifications)

      const result = await service.getNotificationStats("user-123")

      expect(result.total).toBe(2)
      expect(result.unread).toBe(1)
      expect(result.byStatus[NotificationStatus.PENDING]).toBe(1)
      expect(result.byStatus[NotificationStatus.READ]).toBe(1)
    })
  })

  describe("retryFailedNotifications", () => {
    it("should queue failed notifications for retry", async () => {
      const failedNotifications = [{ ...mockNotification, status: NotificationStatus.FAILED, retryCount: 1 }]
      mockRepository.find.mockResolvedValue(failedNotifications)
      mockQueue.add.mockResolvedValue({})

      const result = await service.retryFailedNotifications()

      expect(queue.add).toHaveBeenCalledWith("retry-failed", { notificationId: mockNotification.id }, { delay: 60000 })
      expect(result).toBe(1)
    })
  })

  describe("cleanupOldNotifications", () => {
    it("should delete old notifications", async () => {
      mockRepository.delete.mockResolvedValue({ affected: 10 })

      const result = await service.cleanupOldNotifications(30)

      expect(repository.delete).toHaveBeenCalled()
      expect(result).toBe(10)
    })
  })
})
