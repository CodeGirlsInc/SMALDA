import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from "@nestjs/common"
import type { FeedbackService } from "../services/feedback.service"
import type { CreateFeedbackDto } from "../dto/create-feedback.dto"
import type { FeedbackType, FeedbackSource } from "../entities/feedback.entity"
import { RolesGuard } from "../../roles/guards/roles.guard"
import { PermissionsGuard } from "../../roles/guards/permissions.guard"
import { Roles } from "../../roles/decorators/roles.decorator"
import { RequirePermissions } from "../../roles/decorators/permissions.decorator"
import { RoleType } from "../../roles/entities/role.entity"
import { PermissionAction, PermissionResource } from "../../roles/entities/permission.entity"

@Controller("ml-training/feedback")
@UseGuards(RolesGuard, PermissionsGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post("dataset-record/:datasetRecordId")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER, RoleType.USER)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.ANALYTICS })
  create(datasetRecordId: string, @Body() createFeedbackDto: CreateFeedbackDto) {
    return this.feedbackService.create(datasetRecordId, createFeedbackDto)
  }

  @Get("dataset-record/:datasetRecordId")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findByDatasetRecord(datasetRecordId: string) {
    return this.feedbackService.findByDatasetRecord(datasetRecordId)
  }

  @Get("dataset-record/:datasetRecordId/average-rating")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  getAverageRating(datasetRecordId: string) {
    return this.feedbackService.getAverageRatingByDatasetRecord(datasetRecordId)
  }

  @Get("submitter/:submittedBy")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findBySubmitter(submittedBy: string) {
    return this.feedbackService.findBySubmitter(submittedBy)
  }

  @Get("type/:type")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findByType(type: FeedbackType) {
    return this.feedbackService.findByType(type)
  }

  @Get("source/:source")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findBySource(source: FeedbackSource) {
    return this.feedbackService.findBySource(source)
  }

  @Get("statistics")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  getStatistics() {
    return this.feedbackService.getFeedbackStatistics()
  }

  @Patch(":id")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.UPDATE, resource: PermissionResource.ANALYTICS })
  update(@Param("id") id: string, @Body() updateData: Partial<CreateFeedbackDto>) {
    return this.feedbackService.update(id, updateData)
  }

  @Delete(":id")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.DELETE, resource: PermissionResource.ANALYTICS })
  remove(@Param("id") id: string) {
    return this.feedbackService.remove(id)
  }
}
