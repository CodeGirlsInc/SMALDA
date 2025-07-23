import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from "@nestjs/common"
import type { HumanReviewsService } from "../services/human-reviews.service"
import type { CreateHumanReviewDto } from "../dto/create-human-review.dto"
import type { ReviewStatus, ReviewDecision } from "../entities/human-review.entity"
import { RolesGuard } from "../../roles/guards/roles.guard"
import { PermissionsGuard } from "../../roles/guards/permissions.guard"
import { Roles } from "../../roles/decorators/roles.decorator"
import { RequirePermissions } from "../../roles/decorators/permissions.decorator"
import { RoleType } from "../../roles/entities/role.entity"
import { PermissionAction, PermissionResource } from "../../roles/entities/permission.entity"

@Controller("ml-training/human-reviews")
@UseGuards(RolesGuard, PermissionsGuard)
export class HumanReviewsController {
  constructor(private readonly humanReviewsService: HumanReviewsService) {}

  @Post("dataset-record/:datasetRecordId")
  create(datasetRecordId: string, @Body() createHumanReviewDto: CreateHumanReviewDto) {
    return this.humanReviewsService.create(datasetRecordId, createHumanReviewDto)
  }

  @Post("assign")
  @Roles(RoleType.ADMIN, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.REVIEW })
  assignReview(
    @Body() body: { datasetRecordId: string; reviewerId: string; reviewerName: string }
  ) {
    return this.humanReviewsService.assignReview(body.datasetRecordId, body.reviewerId, body.reviewerName)
  }

  @Get("dataset-record/:datasetRecordId")
  @Roles(RoleType.ADMIN, RoleType.ANALYST, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.REVIEW })
  findByDatasetRecord(datasetRecordId: string) {
    return this.humanReviewsService.findByDatasetRecord(datasetRecordId)
  }

  @Get("reviewer/:reviewerId")
  @Roles(RoleType.ADMIN, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.REVIEW })
  findByReviewer(reviewerId: string, @Query("status") status?: ReviewStatus) {
    return this.humanReviewsService.findByReviewer(reviewerId, status)
  }

  @Get("pending")
  @Roles(RoleType.ADMIN, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.REVIEW })
  findPendingReviews(@Query("limit") limit?: number) {
    return this.humanReviewsService.findPendingReviews(limit ? Number.parseInt(limit.toString()) : 10)
  }

  @Get("statistics")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.REVIEW })
  getStatistics(@Query("reviewerId") reviewerId?: string) {
    return this.humanReviewsService.getReviewStatistics(reviewerId)
  }

  @Patch(":id")
  @Roles(RoleType.ADMIN, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.UPDATE, resource: PermissionResource.REVIEW })
  update(@Param("id") id: string, @Body() updateData: Partial<CreateHumanReviewDto>) {
    return this.humanReviewsService.update(id, updateData)
  }

  @Patch(":id/complete")
  @Roles(RoleType.ADMIN, RoleType.REVIEWER)
  @RequirePermissions({ action: PermissionAction.UPDATE, resource: PermissionResource.REVIEW })
  completeReview(
    @Param("id") id: string,
    @Body() body: { 
      decision: ReviewDecision; 
      comments?: string; 
      corrections?: Record<string, any> 
    },
  ) {
    return this.humanReviewsService.completeReview(id, body.decision, body.comments, body.corrections)
  }
}
