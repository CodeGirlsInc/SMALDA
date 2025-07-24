import { Injectable, ConflictException } from "@nestjs/common"
import { type Repository, In, IsNull } from "typeorm"
import type { Tag } from "./entities/tag.entity"
import type { CreateTagDto } from "./dto/create-tag.dto"
import type { UpdateTagDto } from "./dto/update-tag.dto"
import type { FilterTagDto } from "./dto/filter-tag.dto"

@Injectable()
export class TaggingService {
  constructor(private tagRepository: Repository<Tag>) {}

  /**
   * Creates a new tag.
   * @param createTagDto The DTO containing tag data.
   * @returns The created tag entity.
   * @throws ConflictException if a tag with the same name already exists.
   */
  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const existingTag = await this.tagRepository.findOne({ where: { name: createTagDto.name, deletedAt: IsNull() } })
    if (existingTag) {
      throw new ConflictException(`Tag with name "${createTagDto.name}" already exists.`)
    }
    const tag = this.tagRepository.create(createTagDto)
    return this.tagRepository.save(tag)
  }

  /**
   * Retrieves all tags with optional filtering, pagination, and sorting.
   * @param filterDto The DTO containing filter, pagination, and sort parameters.
   * @returns An object containing tags and total count.
   */
  async findAll(filterDto: FilterTagDto): Promise<{ data: Tag[]; total: number }> {
    const { search, page = 1, limit = 10, sortBy = "name", sortOrder = "ASC" } = filterDto

    const queryBuilder = this.tagRepository.createQueryBuilder("tag")
    queryBuilder.where("tag.deletedAt IS NULL")

    if (search) {
      queryBuilder.andWhere("tag.name ILIKE :search", { search: `%${search}%` })
    }

    queryBuilder.orderBy(`tag.${sortBy}`, sortOrder)
    queryBuilder.skip((page - 1) * limit).take(limit)

    const [data, total] = await queryBuilder.getManyAndCount()
    return { data, total }
  }

  /**
   * Retrieves a single tag by its ID.
   * @param id The UUID of the tag.
   * @returns The tag entity or undefined if not found.
   */
  async findOne(id: string): Promise<Tag | undefined> {
    return this.tagRepository.findOne({ where: { id, deletedAt: IsNull() } })
  }

  /**
   * Finds existing tags by their names or creates new ones if they don't exist.
   * This is useful for associating tags with documents.
   * @param tagNames An array of tag names.
   * @returns A Promise that resolves to an array of Tag entities.
   */
  async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
    if (!tagNames || tagNames.length === 0) {
      return []
    }

    const uniqueTagNames = [...new Set(tagNames.map((name) => name.toLowerCase()))]
    const existingTags = await this.tagRepository.find({
      where: { name: In(uniqueTagNames), deletedAt: IsNull() },
    })

    const existingTagNames = new Set(existingTags.map((tag) => tag.name))
    const newTagNames = uniqueTagNames.filter((name) => !existingTagNames.has(name))

    const newTags = newTagNames.map((name) => this.tagRepository.create({ name }))
    const savedNewTags = await this.tagRepository.save(newTags)

    return [...existingTags, ...savedNewTags]
  }

  /**
   * Updates an existing tag.
   * @param id The UUID of the tag.
   * @param updateTagDto The DTO containing updated tag data.
   * @returns The updated tag entity or undefined if not found.
   * @throws ConflictException if the new name already exists for another tag.
   */
  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag | undefined> {
    const tag = await this.findOne(id)
    if (!tag) {
      return undefined
    }

    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      const existingTagWithName = await this.tagRepository.findOne({
        where: { name: updateTagDto.name, id: In([id]), deletedAt: IsNull() }, // Check for existing tag with same name but different ID
      })
      if (existingTagWithName && existingTagWithName.id !== id) {
        throw new ConflictException(`Tag with name "${updateTagDto.name}" already exists.`)
      }
    }

    Object.assign(tag, updateTagDto)
    return this.tagRepository.save(tag)
  }

  /**
   * Soft deletes a tag.
   * @param id The UUID of the tag.
   * @returns True if deleted, false if not found.
   */
  async remove(id: string): Promise<boolean> {
    const result = await this.tagRepository.softDelete(id)
    return result.affected > 0
  }
}
