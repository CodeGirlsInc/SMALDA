import { Test, type TestingModule } from "@nestjs/testing"
import { TaggingService } from "./tagging.service"
import { TaggingController } from "./tagging.controller"
import { getRepositoryToken } from "@nestjs/typeorm"
import { Tag } from "./entities/tag.entity"
import type { Repository } from "typeorm"
import type { CreateTagDto } from "./dto/create-tag.dto"
import type { UpdateTagDto } from "./dto/update-tag.dto"
import type { FilterTagDto } from "./dto/filter-tag.dto"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { jest } from "@jest/globals" // Import jest to declare it

// Mock Repository
const mockTagRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
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

describe("TaggingService", () => {
  let service: TaggingService
  let tagRepository: Repository<Tag>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaggingService,
        {
          provide: getRepositoryToken(Tag),
          useValue: mockTagRepository,
        },
      ],
    }).compile()

    service = module.get<TaggingService>(TaggingService)
    tagRepository = module.get<Repository<Tag>>(getRepositoryToken(Tag))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("create", () => {
    it("should create and save a new tag", async () => {
      const createDto: CreateTagDto = { name: "New Tag" }
      const expectedTag = { id: "tag-1", ...createDto, createdAt: new Date(), updatedAt: new Date() }

      mockTagRepository.findOne.mockResolvedValue(undefined)
      mockTagRepository.create.mockReturnValue(expectedTag)
      mockTagRepository.save.mockResolvedValue(expectedTag)

      const result = await service.create(createDto)
      expect(mockTagRepository.findOne).toHaveBeenCalledWith({ where: { name: createDto.name, deletedAt: null } })
      expect(mockTagRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockTagRepository.save).toHaveBeenCalledWith(expectedTag)
      expect(result).toEqual(expectedTag)
    })

    it("should throw ConflictException if tag name already exists", async () => {
      const createDto: CreateTagDto = { name: "Existing Tag" }
      mockTagRepository.findOne.mockResolvedValue({ id: "tag-existing", name: "Existing Tag" })

      await expect(service.create(createDto)).rejects.toThrow(ConflictException)
      expect(mockTagRepository.create).not.toHaveBeenCalled()
      expect(mockTagRepository.save).not.toHaveBeenCalled()
    })
  })

  describe("findAll", () => {
    it("should return all tags with pagination and total count", async () => {
      const tagList = [{ id: "tag-1", name: "Tag A" }]
      mockTagRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([tagList, 1])

      const result = await service.findAll({})
      expect(mockTagRepository.createQueryBuilder).toHaveBeenCalled()
      expect(result).toEqual({ data: tagList, total: 1 })
    })

    it("should apply filters and sorting", async () => {
      const filterDto: FilterTagDto = { search: "test", sortBy: "createdAt", sortOrder: "DESC", page: 2, limit: 5 }
      const tagList = [{ id: "tag-2", name: "Test Tag" }]
      mockTagRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([tagList, 1])

      const queryBuilderMock = mockTagRepository.createQueryBuilder()
      const result = await service.findAll(filterDto)

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith("tag.name ILIKE :search", { search: "%test%" })
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith("tag.createdAt", "DESC")
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(5)
      expect(queryBuilderMock.take).toHaveBeenCalledWith(5)
      expect(result).toEqual({ data: tagList, total: 1 })
    })
  })

  describe("findOne", () => {
    it("should return a tag if found", async () => {
      const tag = { id: "tag-1", name: "Test Tag" }
      mockTagRepository.findOne.mockResolvedValue(tag)

      const result = await service.findOne("tag-1")
      expect(mockTagRepository.findOne).toHaveBeenCalledWith({ where: { id: "tag-1", deletedAt: null } })
      expect(result).toEqual(tag)
    })

    it("should return undefined if tag not found", async () => {
      mockTagRepository.findOne.mockResolvedValue(undefined)
      const result = await service.findOne("non-existent-id")
      expect(result).toBeUndefined()
    })
  })

  describe("findOrCreateTags", () => {
    it("should find existing tags and create new ones", async () => {
      const tagNames = ["existing tag", "new tag 1", "Existing Tag"] // Case insensitive, duplicates
      const existingTag = { id: "tag-e1", name: "existing tag" }
      const newTag1 = { id: "tag-n1", name: "new tag 1" }

      mockTagRepository.find.mockResolvedValue([existingTag])
      mockTagRepository.create.mockImplementation((dto) => ({ id: "temp-id", ...dto }))
      mockTagRepository.save.mockResolvedValueOnce([newTag1])

      const result = await service.findOrCreateTags(tagNames)

      expect(mockTagRepository.find).toHaveBeenCalledWith({
        where: { name: expect.arrayContaining(["existing tag", "new tag 1"]), deletedAt: null },
      })
      expect(mockTagRepository.create).toHaveBeenCalledWith({ name: "new tag 1" })
      expect(mockTagRepository.save).toHaveBeenCalledWith([expect.objectContaining({ name: "new tag 1" })])
      expect(result).toEqual(expect.arrayContaining([existingTag, newTag1]))
      expect(result.length).toBe(2) // Only unique tags
    })

    it("should return empty array if no tag names provided", async () => {
      const result = await service.findOrCreateTags([])
      expect(result).toEqual([])
      expect(mockTagRepository.find).not.toHaveBeenCalled()
      expect(mockTagRepository.save).not.toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("should update an existing tag", async () => {
      const existingTag = { id: "tag-1", name: "Old Tag", createdAt: new Date(), updatedAt: new Date() }
      const updateDto: UpdateTagDto = { name: "Updated Tag" }
      const updatedTag = { ...existingTag, ...updateDto }

      mockTagRepository.findOne.mockResolvedValue(existingTag)
      mockTagRepository.save.mockResolvedValue(updatedTag)

      const result = await service.update("tag-1", updateDto)
      expect(mockTagRepository.findOne).toHaveBeenCalledWith({ where: { id: "tag-1", deletedAt: null } })
      expect(mockTagRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tag-1",
          name: "Updated Tag",
        }),
      )
      expect(result).toEqual(updatedTag)
    })

    it("should return undefined if tag not found for update", async () => {
      mockTagRepository.findOne.mockResolvedValue(undefined)
      const result = await service.update("non-existent-id", { name: "New Name" })
      expect(result).toBeUndefined()
    })

    it("should throw ConflictException if new tag name already exists for another tag", async () => {
      const existingTag = { id: "tag-1", name: "Tag A" }
      const anotherTag = { id: "tag-2", name: "Tag B" }
      const updateDto: UpdateTagDto = { name: "Tag B" }

      mockTagRepository.findOne.mockResolvedValue(existingTag) // Find the tag to update
      mockTagRepository.findOne.mockImplementation((options) => {
        if (options.where.id && options.where.id.value[0] === "tag-1") {
          return Promise.resolve(existingTag)
        }
        if (options.where.name === "Tag B" && options.where.id.value[0] !== "tag-1") {
          return Promise.resolve(anotherTag) // Simulate finding another tag with the same name
        }
        return Promise.resolve(undefined)
      })

      await expect(service.update("tag-1", updateDto)).rejects.toThrow(ConflictException)
      expect(mockTagRepository.save).not.toHaveBeenCalled()
    })
  })

  describe("remove", () => {
    it("should soft delete a tag", async () => {
      mockTagRepository.softDelete.mockResolvedValue({ affected: 1 })

      const result = await service.remove("tag-1")
      expect(mockTagRepository.softDelete).toHaveBeenCalledWith("tag-1")
      expect(result).toBe(true)
    })

    it("should return false if tag not found for deletion", async () => {
      mockTagRepository.softDelete.mockResolvedValue({ affected: 0 })

      const result = await service.remove("non-existent-id")
      expect(result).toBe(false)
    })
  })
})

describe("TaggingController", () => {
  let controller: TaggingController
  let service: TaggingService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaggingController],
      providers: [
        {
          provide: TaggingService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<TaggingController>(TaggingController)
    service = module.get<TaggingService>(TaggingService)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })

  describe("create", () => {
    it("should call service.create and return the created tag", async () => {
      const createDto: CreateTagDto = { name: "New Tag" }
      const expectedTag = { id: "tag-1", ...createDto }
      jest.spyOn(service, "create").mockResolvedValue(expectedTag as Tag)

      const result = await controller.create(createDto)
      expect(service.create).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(expectedTag)
    })

    it("should throw ConflictException if service.create throws ConflictException", async () => {
      const createDto: CreateTagDto = { name: "Existing Tag" }
      jest.spyOn(service, "create").mockRejectedValue(new ConflictException("Tag already exists."))

      await expect(controller.create(createDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("findAll", () => {
    it("should call service.findAll and return a list of tags", async () => {
      const filterDto: FilterTagDto = { page: 1, limit: 10 }
      const tagList = { data: [{ id: "tag-1", name: "Test" }], total: 1 }
      jest.spyOn(service, "findAll").mockResolvedValue(tagList as any)

      const result = await controller.findAll(filterDto)
      expect(service.findAll).toHaveBeenCalledWith(filterDto)
      expect(result).toEqual(tagList)
    })
  })

  describe("findOne", () => {
    it("should call service.findOne and return a single tag", async () => {
      const tag = { id: "tag-1", name: "Test" }
      jest.spyOn(service, "findOne").mockResolvedValue(tag as Tag)

      const result = await controller.findOne("tag-1")
      expect(service.findOne).toHaveBeenCalledWith("tag-1")
      expect(result).toEqual(tag)
    })

    it("should throw NotFoundException if tag not found", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(undefined)
      await expect(controller.findOne("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("update", () => {
    it("should call service.update and return the updated tag", async () => {
      const updateDto: UpdateTagDto = { name: "Updated Tag" }
      const updatedTag = { id: "tag-1", name: "Updated Tag" }
      jest.spyOn(service, "update").mockResolvedValue(updatedTag as Tag)

      const result = await controller.update("tag-1", updateDto)
      expect(service.update).toHaveBeenCalledWith("tag-1", updateDto)
      expect(result).toEqual(updatedTag)
    })

    it("should throw NotFoundException if tag not found for update", async () => {
      jest.spyOn(service, "update").mockResolvedValue(undefined)
      await expect(controller.update("non-existent-id", {})).rejects.toThrow(NotFoundException)
    })

    it("should throw ConflictException if service.update throws ConflictException", async () => {
      const updateDto: UpdateTagDto = { name: "Conflicting Tag" }
      jest.spyOn(service, "update").mockRejectedValue(new ConflictException("Tag name already exists."))

      await expect(controller.update("tag-1", updateDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("remove", () => {
    it("should call service.remove and return nothing on success", async () => {
      jest.spyOn(service, "remove").mockResolvedValue(true)
      const result = await controller.remove("tag-1")
      expect(service.remove).toHaveBeenCalledWith("tag-1")
      expect(result).toBeUndefined() // No content response
    })

    it("should throw NotFoundException if tag not found for removal", async () => {
      jest.spyOn(service, "remove").mockResolvedValue(false)
      await expect(controller.remove("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })
})
