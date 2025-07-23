import { Test, type TestingModule } from "@nestjs/testing"
import { NotificationController } from "./notification.controller"
import { NotificationService } from "./notification.service"
import { NotificationType, NotificationEvent, NotificationStatus } from "./entities/notification.entity"
import type { CreateNotificationDto } from "./dto/create-notification.dto"
import type { NotificationQueryDto } from "./dto/notification-query.dto"
import type { NotificationData } from "./interfaces/notification-template.interface"
import { jest } from "@jest/globals"

describe("NotificationController", () => {
  let controller: NotificationController
  let service: NotificationService

  const mockNotification = {
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

  const mockNotificationService = {
    create: jest.fn(),
    sendNotification: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByRecipient: jest.fn(),
    findUnreadByRecipient: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    getNotificationStats: jest.fn(),
    retryFailedNotifications: jest.fn(),
    cleanupOldNotifications: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile()

    controller = module.get<NotificationController>(NotificationController)
    service = module.get<NotificationService>(NotificationService)

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
      }

      mockNotificationService.create.mockResolvedValue(mockNotification)

      const result = await controller.create(createDto)

      expect(service.create).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(mockNotification)
    })
  })

  describe("sendNotification", () => {
    it("should send notification", async () => {
      const notificationData: NotificationData = {
        recipientId: "user-123",
        recipientEmail: "user@example.com",
        event: NotificationEvent.RISK_DETECTED,
        data: { documentName: "test.pdf" },
      }

      mockNotificationService.sendNotification.mockResolvedValue(undefined)

      const result = await controller.sendNotification(notificationData)

      expect(service.sendNotification).toHaveBeenCalledWith(notificationData)
      expect(result).toEqual({ message: "Notification queued successfully" })
    })
  })

  describe("findAll", () => {
    it("should return paginated notifications", async () => {
      const query: NotificationQueryDto = {
        recipientId: "user-123",
        limit: 10,
        offset: 0,
      }

      const response = {
        notifications: [mockNotification],
        total: 1,
        limit: 10,
        offset: 0,
      }

      mockNotificationService.findAll.mockResolvedValue(response)

      const result = await controller.findAll(query)

      expect(service.findAll).toHaveBeenCalledWith(query)
      expect(result).toEqual(response)
    })
  })

  describe("getStats", () => {
    it("should return notification statistics", async () => {
      const stats = {
        total: 100,
        unread: 25,
        byStatus: { PENDING: 25, SENT: 50, READ: 25 },
        byType: { EMAIL: 75, IN_APP: 25 },
        byEvent: { RISK_DETECTED: 50, REVIEW_APPROVED: 50 },
      }

      mockNotificationService.getNotificationStats.mockResolvedValue(stats)

      const result = await controller.getStats("user-123")

      expect(service.getNotificationStats).toHaveBeenCalledWith("user-123")
      expect(result).toEqual(stats)
    })
  })

  describe("findByRecipient", () => {
    it("should return notifications for recipient", async () => {
      const notifications = [mockNotification]
      mockNotificationService.findByRecipient.mockResolvedValue(notifications)

      const result = await controller.findByRecipient("user-123", 10, 0)

      expect(service.findByRecipient).toHaveBeenCalledWith("user-123", 10, 0)
      expect(result).toEqual(notifications)
    })
  })

  describe("findUnreadByRecipient", () => {
    it("should return unread notifications for recipient", async () => {
      const notifications = [mockNotification]
      mockNotificationService.findUnreadByRecipient.mockResolvedValue(notifications)

      const result = await controller.findUnreadByRecipient("user-123")

      expect(service.findUnreadByRecipient).toHaveBeenCalledWith("user-123")
      expect(result).toEqual(notifications)
    })
  })

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      mockNotificationService.markAsRead.mockResolvedValue(undefined)

      const result = await controller.markAsRead("notification-123")

      expect(service.markAsRead).toHaveBeenCalledWith("notification-123")
      expect(result).toEqual({ message: "Notification marked as read" })
    })
  })

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(undefined)

      const result = await controller.markAllAsRead("user-123")

      expect(service.markAllAsRead).toHaveBeenCalledWith("user-123")
      expect(result).toEqual({ message: "All notifications marked as read" })
    })
  })

  describe("retryFailedNotifications", () => {
    it("should retry failed notifications", async () => {
      mockNotificationService.retryFailedNotifications.mockResolvedValue(5)

      const result = await controller.retryFailedNotifications()

      expect(service.retryFailedNotifications).toHaveBeenCalled()
      expect(result).toEqual({ message: "Failed notifications queued for retry", retryCount: 5 })
    })
  })

  describe("cleanupOldNotifications", () => {
    it("should cleanup old notifications", async () => {
      mockNotificationService.cleanupOldNotifications.mockResolvedValue(25)

      const result = await controller.cleanupOldNotifications({ daysToKeep: 30 })

      expect(service.cleanupOldNotifications).toHaveBeenCalledWith(30)
      expect(result).toEqual({ message: "Old notifications cleaned up", deletedCount: 25 })
    })
  })
})
