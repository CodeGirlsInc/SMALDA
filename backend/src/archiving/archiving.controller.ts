import { Controller, Post, Get, Put, Delete, Param, Query, Body, ParseUUIDPipe } from "@nestjs/common"
import type { ArchivingService } from "./archiving.service"
import type {
  CreateArchivePolicyDto,
  UpdateArchivePolicyDto,
  ManualArchiveDto,
  RestoreDocumentDto,
  QueryArchivedDocumentsDto,
} from "./dto/archive.dto"

@Controller("archive")
export class ArchivingController {
  constructor(private readonly archivingService: ArchivingService) {}

  // Archive Policy Management
  @Post("policies")
  async createArchivePolicy(createDto: CreateArchivePolicyDto) {
    const policy = await this.archivingService.createArchivePolicy(createDto)

    return {
      success: true,
      message: "Archive policy created successfully",
      data: policy,
    }
  }

  @Get("policies")
  async getArchivePolicies() {
    const policies = await this.archivingService.getArchivePolicies()

    return {
      success: true,
      data: policies,
    }
  }

  @Get("policies/:id")
  async getArchivePolicy(@Param("id", ParseUUIDPipe) id: string) {
    const policy = await this.archivingService.getArchivePolicy(id)

    return {
      success: true,
      data: policy,
    }
  }

  @Put("policies/:id")
  async updateArchivePolicy(@Param("id", ParseUUIDPipe) id: string, updateDto: UpdateArchivePolicyDto) {
    const policy = await this.archivingService.updateArchivePolicy(id, updateDto)

    return {
      success: true,
      message: "Archive policy updated successfully",
      data: policy,
    }
  }

  @Delete("policies/:id")
  async deleteArchivePolicy(@Param("id", ParseUUIDPipe) id: string) {
    await this.archivingService.deleteArchivePolicy(id)

    return {
      success: true,
      message: "Archive policy deleted successfully",
    }
  }

  // Document Archiving
  @Post("documents")
  async archiveDocuments(archiveDto: ManualArchiveDto) {
    const results = await this.archivingService.archiveMultipleDocuments(archiveDto)

    return {
      success: true,
      message: `${results.length} documents archived successfully`,
      data: results,
    }
  }

  @Get("documents")
  async getArchivedDocuments(@Query() queryDto: QueryArchivedDocumentsDto) {
    const result = await this.archivingService.findArchivedDocuments(queryDto)

    return {
      success: true,
      data: result.documents,
      pagination: {
        total: result.total,
        limit: queryDto.limit,
        offset: queryDto.offset,
        hasMore: result.total > (queryDto.offset + queryDto.limit),
      },
    }
  }

  @Get("documents/:id")
  async getArchivedDocument(@Param("id", ParseUUIDPipe) id: string) {
    const document = await this.archivingService.findArchivedDocument(id)

    return {
      success: true,
      data: document,
    }
  }

  // Document Restoration
  @Post("restore")
  async restoreDocuments(restoreDto: RestoreDocumentDto) {
    const results = await this.archivingService.restoreMultipleDocuments(restoreDto)

    return {
      success: true,
      message: `${results.length} documents restored successfully`,
      data: results,
    }
  }

  @Post("documents/:id/restore")
  async restoreDocument(@Param("id", ParseUUIDPipe) id: string, @Body("restoredBy") restoredBy?: string) {
    const result = await this.archivingService.restoreDocument(id, restoredBy)

    return {
      success: true,
      message: "Document restored successfully",
      data: result,
    }
  }

  @Delete("documents/:id/permanent")
  async permanentlyDeleteArchive(@Param("id", ParseUUIDPipe) id: string) {
    await this.archivingService.permanentlyDeleteArchive(id)

    return {
      success: true,
      message: "Archive permanently deleted",
    }
  }

  // Statistics and Monitoring
  @Get("stats")
  async getArchiveStats() {
    const stats = await this.archivingService.getArchiveStats()

    return {
      success: true,
      data: stats,
    }
  }
}
