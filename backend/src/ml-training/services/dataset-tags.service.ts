import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { DatasetTag, TagCategory } from "../entities/dataset-tag.entity"
import type { CreateDatasetTagDto } from "../dto/create-dataset-tag.dto"

@Injectable()
export class DatasetTagsService {
  constructor(private datasetTagRepository: Repository<DatasetTag>) {}

  async create(createDatasetTagDto: CreateDatasetTagDto): Promise<DatasetTag> {
    const tag = this.datasetTagRepository.create(createDatasetTagDto)
    return this.datasetTagRepository.save(tag)
  }

  async findByDatasetRecord(datasetRecordId: string): Promise<DatasetTag[]> {
    return this.datasetTagRepository.find({
      where: { datasetRecord: { id: datasetRecordId } },
      order: { createdAt: "DESC" },
    })
  }

  async findByCategory(category: TagCategory): Promise<DatasetTag[]> {
    return this.datasetTagRepository.find({
      where: { category },
      relations: ["datasetRecord"],
      order: { createdAt: "DESC" },
    })
  }

  async findPopularTags(limit = 10): Promise<{ name: string; count: number }[]> {
    const result = await this.datasetTagRepository
      .createQueryBuilder("tag")
      .select("tag.name", "name")
      .addSelect("COUNT(*)", "count")
      .groupBy("tag.name")
      .orderBy("count", "DESC")
      .limit(limit)
      .getRawMany()

    return result.map((item) => ({
      name: item.name,
      count: Number.parseInt(item.count),
    }))
  }

  async remove(id: string): Promise<void> {
    const tag = await this.datasetTagRepository.findOne({ where: { id } })

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`)
    }

    await this.datasetTagRepository.remove(tag)
  }

  async bulkCreateTags(
    datasetRecordId: string,
    tags: Omit<CreateDatasetTagDto, "datasetRecordId">[],
  ): Promise<DatasetTag[]> {
    const tagEntities = tags.map((tag) =>
      this.datasetTagRepository.create({
        ...tag,
        datasetRecordId,
      }),
    )

    return this.datasetTagRepository.save(tagEntities)
  }

  async getTagStatistics(): Promise<{
    totalTags: number
    categoryBreakdown: Record<TagCategory, number>
    averageTagsPerRecord: number
  }> {
    const totalTags = await this.datasetTagRepository.count()

    const categoryBreakdown = await this.datasetTagRepository
      .createQueryBuilder("tag")
      .select("tag.category", "category")
      .addSelect("COUNT(*)", "count")
      .groupBy("tag.category")
      .getRawMany()

    const recordsWithTags = await this.datasetTagRepository
      .createQueryBuilder("tag")
      .select("COUNT(DISTINCT tag.datasetRecordId)", "uniqueRecords")
      .getRawOne()

    const averageTagsPerRecord =
      recordsWithTags.uniqueRecords > 0 ? totalTags / Number.parseInt(recordsWithTags.uniqueRecords) : 0

    return {
      totalTags,
      categoryBreakdown: categoryBreakdown.reduce(
        (acc, item) => {
          acc[item.category] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<TagCategory, number>,
      ),
      averageTagsPerRecord: Math.round(averageTagsPerRecord * 100) / 100,
    }
  }
}
