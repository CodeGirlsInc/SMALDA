import { Test, type TestingModule } from "@nestjs/testing"
import { PropertyOwnerService } from "./property-owner.service"
import { PropertyOwnerController } from "./property-owner.controller"
import { getRepositoryToken } from "@nestjs/typeorm"
import { PropertyOwner } from "./entities/property-owner.entity"
import type { Repository } from "typeorm"
import type { CreatePropertyOwnerDto } from "./dto/create-property-owner.dto"
import type { UpdatePropertyOwnerDto } from "./dto/update-property-owner.dto"
import type { FilterPropertyOwnerDto } from "./dto/filter-property-owner.dto"
import { OwnerType } from "./enums/owner-type.enum"
import { CorporateType } from "./enums/corporate-type.enum"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { jest } from "@jest/globals"

// Mock Repository
const mockPropertyOwnerRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
}

describe("PropertyOwnerService", () => {
  let service: PropertyOwnerService
  let propertyOwnerRepository: Repository<PropertyOwner>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyOwnerService,
        {
          provide: getRepositoryToken(PropertyOwner),
          useValue: mockPropertyOwnerRepository,
        },
      ],
    }).compile()

    service = module.get<PropertyOwnerService>(PropertyOwnerService)
    propertyOwnerRepository = module.get<Repository<PropertyOwner>>(getRepositoryToken(PropertyOwner))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("create", () => {
    it("should create and save a new individual property owner", async () => {
      const createDto: CreatePropertyOwnerDto = {
        ownerType: OwnerType.INDIVIDUAL,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        address: "123 Main St",
        dateOfBirth: "1990-01-01",
      }
      const expectedOwner = {
        id: "owner-1",
        ...createDto,
        dateOfBirth: new Date("1990-01-01"),
        country: "Nigeria",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPropertyOwnerRepository.findOne.mockResolvedValue(undefined)
      mockPropertyOwnerRepository.create.mockReturnValue(expectedOwner)
      mockPropertyOwnerRepository.save.mockResolvedValue(expectedOwner)

      const result = await service.create(createDto)
      expect(mockPropertyOwnerRepository.findOne).toHaveBeenCalledWith({
        where: { email: createDto.email, deletedAt: null },
      })
      expect(mockPropertyOwnerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          dateOfBirth: new Date("1990-01-01"),
          country: "Nigeria",
          isActive: true,
        }),
      )
      expect(mockPropertyOwnerRepository.save).toHaveBeenCalledWith(expectedOwner)
      expect(result).toEqual(expectedOwner)
    })

    it("should create and save a new corporate property owner", async () => {
      const createDto: CreatePropertyOwnerDto = {
        ownerType: OwnerType.CORPORATE,
        companyName: "Acme Corp",
        email: "contact@acme.com",
        address: "456 Business Ave",
        corporateType: CorporateType.COMPANY,
        registrationNumber: "RC123456",
        incorporationDate: "2020-01-01",
      }
      const expectedOwner = {
        id: "owner-2",
        ...createDto,
        incorporationDate: new Date("2020-01-01"),
        country: "Nigeria",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPropertyOwnerRepository.findOne.mockResolvedValue(undefined)
      mockPropertyOwnerRepository.create.mockReturnValue(expectedOwner)
      mockPropertyOwnerRepository.save.mockResolvedValue(expectedOwner)

      const result = await service.create(createDto)
      expect(mockPropertyOwnerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          incorporationDate: new Date("2020-01-01"),
          country: "Nigeria",
          isActive: true,
        }),
      )
      expect(result).toEqual(expectedOwner)
    })

    it("should throw ConflictException if email already exists", async () => {
      const createDto: CreatePropertyOwnerDto = {
        ownerType: OwnerType.INDIVIDUAL,
        firstName: "Jane",
        lastName: "Smith",
        email: "existing@example.com",
        address: "789 Oak St",
      }
      mockPropertyOwnerRepository.findOne.mockResolvedValue({ id: "existing-owner", email: "existing@example.com" })

      await expect(service.create(createDto)).rejects.toThrow(ConflictException)
      expect(mockPropertyOwnerRepository.create).not.toHaveBeenCalled()
      expect(mockPropertyOwnerRepository.save).not.toHaveBeenCalled()
    })
  })

  describe("findAll", () => {
    it("should return all property owners with pagination and total count", async () => {
      const ownerList = [{ id: "owner-1", firstName: "John", lastName: "Doe" }]
      mockPropertyOwnerRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([ownerList, 1])

      const result = await service.findAll({})
      expect(mockPropertyOwnerRepository.createQueryBuilder).toHaveBeenCalled()
      expect(result).toEqual({ data: ownerList, total: 1 })
    })

    it("should apply filters and sorting", async () => {
      const filterDto: FilterPropertyOwnerDto = {
        ownerType: OwnerType.INDIVIDUAL,
        search: "john",
        city: "Lagos",
        isActive: true,
        sortBy: "firstName",
        sortOrder: "ASC",
        page: 2,
        limit: 5,
      }
      const ownerList = [{ id: "owner-2", firstName: "John", city: "Lagos" }]
      mockPropertyOwnerRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([ownerList, 1])

      const queryBuilderMock = mockPropertyOwnerRepository.createQueryBuilder()
      const result = await service.findAll(filterDto)

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("owner.ownerType = :ownerType", {
        ownerType: OwnerType.INDIVIDUAL,
      })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        "(owner.firstName ILIKE :search OR owner.lastName ILIKE :search OR owner.companyName ILIKE :search)",
        { search: "%john%" },
      )
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("owner.city ILIKE :city", { city: "%Lagos%" })
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("owner.isActive = :isActive", { isActive: true })
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith("owner.firstName", "ASC")
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(5)
      expect(queryBuilderMock.take).toHaveBeenCalledWith(5)
      expect(result).toEqual({ data: ownerList, total: 1 })
    })
  })

  describe("findOne", () => {
    it("should return a property owner with documents if found", async () => {
      const owner = { id: "owner-1", firstName: "John", documents: [] }
      mockPropertyOwnerRepository.findOne.mockResolvedValue(owner)

      const result = await service.findOne("owner-1")
      expect(mockPropertyOwnerRepository.findOne).toHaveBeenCalledWith({
        where: { id: "owner-1", deletedAt: null },
        relations: ["documents"],
      })
      expect(result).toEqual(owner)
    })

    it("should return undefined if property owner not found", async () => {
      mockPropertyOwnerRepository.findOne.mockResolvedValue(undefined)
      const result = await service.findOne("non-existent-id")
      expect(result).toBeUndefined()
    })
  })

  describe("findByEmail", () => {
    it("should return a property owner if found by email", async () => {
      const owner = { id: "owner-1", email: "test@example.com" }
      mockPropertyOwnerRepository.findOne.mockResolvedValue(owner)

      const result = await service.findByEmail("test@example.com")
      expect(mockPropertyOwnerRepository.findOne).toHaveBeenCalledWith({
        where: { email: "test@example.com", deletedAt: null },
      })
      expect(result).toEqual(owner)
    })
  })

  describe("update", () => {
    it("should update an existing property owner", async () => {
      const existingOwner = {
        id: "owner-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const updateDto: UpdatePropertyOwnerDto = { firstName: "Johnny", city: "Lagos" }
      const updatedOwner = { ...existingOwner, ...updateDto }

      mockPropertyOwnerRepository.findOne.mockResolvedValue(existingOwner)
      mockPropertyOwnerRepository.save.mockResolvedValue(updatedOwner)

      const result = await service.update("owner-1", updateDto)
      expect(mockPropertyOwnerRepository.findOne).toHaveBeenCalledWith({
        where: { id: "owner-1", deletedAt: null },
        relations: ["documents"],
      })
      expect(mockPropertyOwnerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "owner-1",
          firstName: "Johnny",
          city: "Lagos",
        }),
      )
      expect(result).toEqual(updatedOwner)
    })

    it("should return undefined if property owner not found for update", async () => {
      mockPropertyOwnerRepository.findOne.mockResolvedValue(undefined)
      const result = await service.update("non-existent-id", { firstName: "New Name" })
      expect(result).toBeUndefined()
    })

    it("should throw ConflictException if new email already exists for another owner", async () => {
      const existingOwner = { id: "owner-1", email: "john@example.com" }
      const anotherOwner = { id: "owner-2", email: "jane@example.com" }
      const updateDto: UpdatePropertyOwnerDto = { email: "jane@example.com" }

      mockPropertyOwnerRepository.findOne
        .mockResolvedValueOnce(existingOwner) // First call for findOne
        .mockResolvedValueOnce(anotherOwner) // Second call for email conflict check

      await expect(service.update("owner-1", updateDto)).rejects.toThrow(ConflictException)
      expect(mockPropertyOwnerRepository.save).not.toHaveBeenCalled()
    })
  })

  describe("remove", () => {
    it("should soft delete a property owner", async () => {
      mockPropertyOwnerRepository.softDelete.mockResolvedValue({ affected: 1 })

      const result = await service.remove("owner-1")
      expect(mockPropertyOwnerRepository.softDelete).toHaveBeenCalledWith("owner-1")
      expect(result).toBe(true)
    })

    it("should return false if property owner not found for deletion", async () => {
      mockPropertyOwnerRepository.softDelete.mockResolvedValue({ affected: 0 })

      const result = await service.remove("non-existent-id")
      expect(result).toBe(false)
    })
  })

  describe("findByType", () => {
    it("should return property owners by type", async () => {
      const individualOwners = [{ id: "owner-1", ownerType: OwnerType.INDIVIDUAL }]
      mockPropertyOwnerRepository.find.mockResolvedValue(individualOwners)

      const result = await service.findByType(OwnerType.INDIVIDUAL)
      expect(mockPropertyOwnerRepository.find).toHaveBeenCalledWith({
        where: { ownerType: OwnerType.INDIVIDUAL, deletedAt: null },
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(individualOwners)
    })
  })

  describe("findActive", () => {
    it("should return active property owners", async () => {
      const activeOwners = [{ id: "owner-1", isActive: true }]
      mockPropertyOwnerRepository.find.mockResolvedValue(activeOwners)

      const result = await service.findActive()
      expect(mockPropertyOwnerRepository.find).toHaveBeenCalledWith({
        where: { isActive: true, deletedAt: null },
        order: { createdAt: "DESC" },
      })
      expect(result).toEqual(activeOwners)
    })
  })

  describe("getStatistics", () => {
    it("should return property owner statistics", async () => {
      mockPropertyOwnerRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // individual
        .mockResolvedValueOnce(40) // corporate
        .mockResolvedValueOnce(90) // active
        .mockResolvedValueOnce(10) // inactive

      const result = await service.getStatistics()
      expect(result).toEqual({
        total: 100,
        individual: 60,
        corporate: 40,
        active: 90,
        inactive: 10,
      })
    })
  })
})

describe("PropertyOwnerController", () => {
  let controller: PropertyOwnerController
  let service: PropertyOwnerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyOwnerController],
      providers: [
        {
          provide: PropertyOwnerService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findByType: jest.fn(),
            findActive: jest.fn(),
            getStatistics: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<PropertyOwnerController>(PropertyOwnerController)
    service = module.get<PropertyOwnerService>(PropertyOwnerService)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  describe("create", () => {
    it("should call service.create and return the created property owner", async () => {
      const createDto: CreatePropertyOwnerDto = {
        ownerType: OwnerType.INDIVIDUAL,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        address: "123 Main St",
      }
      const expectedOwner = { id: "owner-1", ...createDto }
      jest.spyOn(service, "create").mockResolvedValue(expectedOwner as PropertyOwner)

      const result = await controller.create(createDto)
      expect(service.create).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(expectedOwner)
    })

    it("should throw ConflictException if service.create throws ConflictException", async () => {
      const createDto: CreatePropertyOwnerDto = {
        ownerType: OwnerType.INDIVIDUAL,
        firstName: "John",
        lastName: "Doe",
        email: "existing@example.com",
        address: "123 Main St",
      }
      jest.spyOn(service, "create").mockRejectedValue(new ConflictException("Email already exists."))

      await expect(controller.create(createDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("findAll", () => {
    it("should call service.findAll and return a list of property owners", async () => {
      const filterDto: FilterPropertyOwnerDto = { page: 1, limit: 10 }
      const ownerList = { data: [{ id: "owner-1", firstName: "John" }], total: 1 }
      jest.spyOn(service, "findAll").mockResolvedValue(ownerList as any)

      const result = await controller.findAll(filterDto)
      expect(service.findAll).toHaveBeenCalledWith(filterDto)
      expect(result).toEqual(ownerList)
    })
  })

  describe("getStatistics", () => {
    it("should call service.getStatistics and return statistics", async () => {
      const stats = { total: 100, individual: 60, corporate: 40, active: 90, inactive: 10 }
      jest.spyOn(service, "getStatistics").mockResolvedValue(stats)

      const result = await controller.getStatistics()
      expect(service.getStatistics).toHaveBeenCalled()
      expect(result).toEqual(stats)
    })
  })

  describe("findByType", () => {
    it("should call service.findByType and return property owners by type", async () => {
      const owners = [{ id: "owner-1", ownerType: OwnerType.INDIVIDUAL }]
      jest.spyOn(service, "findByType").mockResolvedValue(owners as PropertyOwner[])

      const result = await controller.findByType(OwnerType.INDIVIDUAL)
      expect(service.findByType).toHaveBeenCalledWith(OwnerType.INDIVIDUAL)
      expect(result).toEqual(owners)
    })
  })

  describe("findActive", () => {
    it("should call service.findActive and return active property owners", async () => {
      const activeOwners = [{ id: "owner-1", isActive: true }]
      jest.spyOn(service, "findActive").mockResolvedValue(activeOwners as PropertyOwner[])

      const result = await controller.findActive()
      expect(service.findActive).toHaveBeenCalled()
      expect(result).toEqual(activeOwners)
    })
  })

  describe("findOne", () => {
    it("should call service.findOne and return a single property owner", async () => {
      const owner = { id: "owner-1", firstName: "John" }
      jest.spyOn(service, "findOne").mockResolvedValue(owner as PropertyOwner)

      const result = await controller.findOne("owner-1")
      expect(service.findOne).toHaveBeenCalledWith("owner-1")
      expect(result).toEqual(owner)
    })

    it("should throw NotFoundException if property owner not found", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(undefined)
      await expect(controller.findOne("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("update", () => {
    it("should call service.update and return the updated property owner", async () => {
      const updateDto: UpdatePropertyOwnerDto = { firstName: "Johnny" }
      const updatedOwner = { id: "owner-1", firstName: "Johnny" }
      jest.spyOn(service, "update").mockResolvedValue(updatedOwner as PropertyOwner)

      const result = await controller.update("owner-1", updateDto)
      expect(service.update).toHaveBeenCalledWith("owner-1", updateDto)
      expect(result).toEqual(updatedOwner)
    })

    it("should throw NotFoundException if property owner not found for update", async () => {
      jest.spyOn(service, "update").mockResolvedValue(undefined)
      await expect(controller.update("non-existent-id", {})).rejects.toThrow(NotFoundException)
    })

    it("should throw ConflictException if service.update throws ConflictException", async () => {
      const updateDto: UpdatePropertyOwnerDto = { email: "conflicting@example.com" }
      jest.spyOn(service, "update").mockRejectedValue(new ConflictException("Email already exists."))

      await expect(controller.update("owner-1", updateDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("remove", () => {
    it("should call service.remove and return nothing on success", async () => {
      jest.spyOn(service, "remove").mockResolvedValue(true)
      const result = await controller.remove("owner-1")
      expect(service.remove).toHaveBeenCalledWith("owner-1")
      expect(result).toBeUndefined()
    })

    it("should throw NotFoundException if property owner not found for removal", async () => {
      jest.spyOn(service, "remove").mockResolvedValue(false)
      await expect(controller.remove("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })
})
