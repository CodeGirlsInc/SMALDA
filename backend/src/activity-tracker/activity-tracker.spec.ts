import { Test, type TestingModule } from "@nestjs/testing"
import { ActivityTrackerController } from "./activity-tracker.controller"
import { ActivityTrackerService } from "./activity-tracker.service"
import { getRepositoryToken } from "@nestjs/typeorm"
import { Activity } from "./entities/activity.entity"
import type { Repository } from "typeorm"
import type { CreateActivityDto } from "./dto/create-activity.dto"
import type { FilterActivityDto } from "./dto/filter-activity.dto"
import { ActivityAction } from "./enums/activity-action.enum"
import { jest } from "@jest/globals"

// Mock Repository
const mockActivityRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
}

describe("ActivityTrackerService", () => {
  let service: ActivityTrackerService
  let activityRepository: Repository<Activity>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityTrackerService,
        {
          provide: getRepositoryToken(Activity),
          useValue: mockActivityRepository,
        },
      ],
    }).compile()

    service = module.get<ActivityTrackerService>(ActivityTrackerService)
    activityRepository = module.get<Repository<Activity>>(getRepositoryToken(Activity))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("logActivity", () => {
    it("should create and save a new activity log", async () => {
      const createDto: CreateActivityDto = {
        userId: "user-123",
        actionType: ActivityAction.LOGIN,
        details: { ipAddress: "192.168.1.1" },
      }
      const expectedActivity = {
        id: "activity-1",
        ...createDto,
        timestamp: new Date(),
      }

      mockActivityRepository.create.mockReturnValue(expectedActivity)
      mockActivityRepository.save.mockResolvedValue(expectedActivity)

      const result = await service.logActivity(createDto)
      expect(mockActivityRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockActivityRepository.save).toHaveBeenCalledWith(expectedActivity)
      expect(result).toEqual(expectedActivity)
    })
  })

  describe("findActivities", () => {
    it("should return all activities with pagination and total count", async () => {
      const activityList = [{ id: "activity-1", userId: "user-1", actionType: ActivityAction.LOGIN }]
      mockActivityRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([activityList, 1])

      const result = await service.findActivities({})
      expect(mockActivityRepository.createQueryBuilder).toHaveBeenCalled()
      expect(result).toEqual({ data: activityList, total: 1 })
    })

    it("should apply all filters and pagination", async () => {
      const filterDto: FilterActivityDto = {
        userId: "user-abc",
        actionType: ActivityAction.DOCUMENT_UPLOAD,
        startDate: "2023-01-01T00:00:00Z",
        endDate: "2023-01-31T23:59:59Z",
        page: 2,
        limit: 5,
        sortBy: "timestamp",
        sortOrder: "ASC",
      }
      const activityList = [{ id: "activity-2", userId: "user-abc", actionType: ActivityAction.DOCUMENT_UPLOAD }]
      mockActivityRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([activityList, 1])

      const queryBuilderMock = mockActivityRepository.createQueryBuilder()
      const result = await service.findActivities(filterDto)

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("activity.userId = :userId", { userId: "user-abc" })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("activity.actionType = :actionType", {
        actionType: ActivityAction.DOCUMENT_UPLOAD,
      })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("activity.timestamp >= :startDate", {
        startDate: new Date("2023-01-01T00:00:00Z"),
      })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("activity.timestamp <= :endDate", {
        endDate: new Date("2023-01-31T23:59:59Z"),
      })
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith("activity.timestamp", "ASC")
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(5)
      expect(queryBuilderMock.take).toHaveBeenCalledWith(5)
      expect(result).toEqual({ data: activityList, total: 1 })
    })
  })

  describe("findActivitiesByUserId", () => {
    it("should return activities for a specific user ID", async () => {
      const activities = [{ id: "activity-1", userId: "user-123", actionType: ActivityAction.LOGIN }]
      mockActivityRepository.find.mockResolvedValue(activities)

      const result = await service.findActivitiesByUserId("user-123")
      expect(mockActivityRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        order: { timestamp: "DESC" },
      })
      expect(result).toEqual(activities)
    })

    it("should return an empty array if no activities found for user", async () => {
      mockActivityRepository.find.mockResolvedValue([])
      const result = await service.findActivitiesByUserId("non-existent-user")
      expect(result).toEqual([])
    })
  })
})

describe("ActivityTrackerController", () => {
  let controller: ActivityTrackerController
  let service: ActivityTrackerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityTrackerController],
      providers: [
        {
          provide: ActivityTrackerService,
          useValue: {
            logActivity: jest.fn(),
            findActivities: jest.fn(),
            findActivitiesByUserId: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<ActivityTrackerController>(ActivityTrackerController)
    service = module.get<ActivityTrackerService>(ActivityTrackerService)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  describe("logActivity", () => {
    it("should call service.logActivity and return the created activity", async () => {
      const createDto: CreateActivityDto = {
        userId: "user-123",
        actionType: ActivityAction.LOGIN,
      }
      const expectedActivity = { id: "activity-1", ...createDto }
      jest.spyOn(service, "logActivity").mockResolvedValue(expectedActivity as Activity)

      const result = await controller.logActivity(createDto)
      expect(service.logActivity).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(expectedActivity)
    })
  })

  describe("findAll", () => {
    it("should call service.findActivities and return a list of activities", async () => {
      const filterDto: FilterActivityDto = { page: 1, limit: 10 }
      const activityList = {
        data: [{ id: "activity-1", userId: "user-1", actionType: ActivityAction.LOGIN }],
        total: 1,
      }
      jest.spyOn(service, "findActivities").mockResolvedValue(activityList as any)

      const result = await controller.findAll(filterDto)
      expect(service.findActivities).toHaveBeenCalledWith(filterDto)
      expect(result).toEqual(activityList)
    })
  })

  describe("findByUserId", () => {
    it("should call service.findActivitiesByUserId and return activities for the user", async () => {
      const activities = [{ id: "activity-1", userId: "user-123", actionType: ActivityAction.LOGIN }]
      jest.spyOn(service, "findActivitiesByUserId").mockResolvedValue(activities as Activity[])

      const result = await controller.findByUserId("user-123")
      expect(service.findActivitiesByUserId).toHaveBeenCalledWith("user-123")
      expect(result).toEqual(activities)
    })

    it("should return an empty array if no activities found for the user", async () => {
      jest.spyOn(service, "findActivitiesByUserId").mockResolvedValue([])
      const result = await controller.findByUserId("non-existent-user")
      expect(result).toEqual([])
    })
  })
})
