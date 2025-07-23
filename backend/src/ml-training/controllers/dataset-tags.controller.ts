import { Controller, Get, Post, Param, Delete, Query, UseGuards } from "@nestjs/common"
import type { DatasetTagsService } from "../services/dataset-tags.service"
import type { CreateDatasetTagDto } from "../dto/create-dataset-tag.dto"
import type { TagCategory } from "../entities/dataset-tag.entity"
import { RolesGuard } from "../../roles/guards/roles.guard"
import { PermissionsGuard } from "../../roles/guards/permissions.guard"
import { Roles } from "../../roles/decorators/roles.decorator"
import { RequirePermissions } from "../../roles/decorators/permissions.decorator"
import { RoleType } from "../../roles/entities/role.entity"
import { PermissionAction, PermissionResource } from "../../roles/entities/permission.entity"

@Controller("ml-training/dataset-tags")
@UseGuards(RolesGuard, PermissionsGuard)
export class DatasetTagsController {
  constructor(private readonly datasetTagsService: DatasetTagsService) {}

  @Post()
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.ANALYTICS })
  create(createDatasetTagDto: CreateDatasetTagDto) {
    return this.datasetTagsService.create(createDatasetTagDto)
  }

  @Post("bulk")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.ANALYTICS })
  bulkCreate(body: { datasetRecordId: string; tags: Omit<CreateDatasetTagDto, "datasetRecordId">[] }) {
    return this.datasetTagsService.bulkCreateTags(body.datasetRecordId, body.tags)
  }

  @Get("dataset-record/:datasetRecordId")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findByDatasetRecord(@Param("datasetRecordId") datasetRecordId: string) {
    return this.datasetTagsService.findByDatasetRecord(datasetRecordId)
  }

  @Get("category/:category")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findByCategory(@Param("category") category: TagCategory) {
    return this.datasetTagsService.findByCategory(category)
  }

  @Get("popular")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findPopularTags(@Query("limit") limit?: number) {
    return this.datasetTagsService.findPopularTags(limit ? Number.parseInt(limit.toString()) : 10)
  }

  @Get("statistics")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  getStatistics() {
    return this.datasetTagsService.getTagStatistics()
  }

  @Delete(":id")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.DELETE, resource: PermissionResource.ANALYTICS })
  remove(@Param("id") id: string) {
    return this.datasetTagsService.remove(id)
  }
}
