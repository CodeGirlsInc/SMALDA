import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from "@nestjs/common"
import type { ReviewService } from "../services/review.service"
import type { CreateReviewDto } from "../dto/create-review.dto"
import type { UpdateReviewDto } from "../dto/update-review.dto"
import type { AddCommentDto } from "../dto/add-comment.dto"
import type { ReviewQueryDto } from "../dto/review-query.dto"
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../../auth/guards/roles.guard"
import { Roles } from "../../auth/decorators/roles.decorator"
import { UserRole } from "../../user/enums/user-role.enum"

@Controller("reviews")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.REVIEWER, UserRole.ADMIN)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @Roles(UserRole.ADMIN) // Only admins can create reviews
  async createReview(@Body() createReviewDto: CreateReviewDto) {
    return await this.reviewService.createReview(createReviewDto);
  }

  @Get()
  async findAll(@Query() queryDto: ReviewQueryDto) {
    return await this.reviewService.findAll(queryDto);
  }

  @Get("stats")
  async getStats(@Request() req, @Query('reviewerId') reviewerId?: string) {
    // If not admin, can only see own stats
    const targetReviewerId = req.user.role === UserRole.ADMIN ? reviewerId : req.user.id
    return await this.reviewService.getReviewStats(targetReviewerId)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.reviewService.findOne(id);
  }

  @Put(":id")
  async updateReview(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto, @Request() req) {
    return await this.reviewService.updateReview(id, updateReviewDto, req.user.id)
  }

  @Post(":id/comments")
  async addComment(@Param('id') id: string, @Body() addCommentDto: AddCommentDto, @Request() req) {
    return await this.reviewService.addComment(id, addCommentDto, req.user.id)
  }

  @Patch(":id/approve")
  @HttpCode(HttpStatus.OK)
  async approveReview(@Param('id') id: string, @Body('notes') notes: string, @Request() req) {
    return await this.reviewService.approveReview(id, req.user.id, notes)
  }

  @Patch(":id/reject")
  @HttpCode(HttpStatus.OK)
  async rejectReview(@Param('id') id: string, @Body('notes') notes: string, @Request() req) {
    if (!notes) {
      throw new BadRequestException("Rejection notes are required")
    }
    return await this.reviewService.rejectReview(id, req.user.id, notes)
  }

  @Patch(":id/escalate")
  @HttpCode(HttpStatus.OK)
  async escalateReview(@Param('id') id: string, @Body('escalationReason') escalationReason: string, @Request() req) {
    if (!escalationReason) {
      throw new BadRequestException("Escalation reason is required")
    }
    return await this.reviewService.escalateReview(id, req.user.id, escalationReason)
  }
}
