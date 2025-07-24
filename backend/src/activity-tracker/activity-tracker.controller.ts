import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from "@nestjs/common"
import type { ActivityTrackerService } from "./activity-tracker.service"
import type { FilterActivityDto } from "./dto/filter-activity.dto"
import { Activity } from "./entities/activity.entity"
import { ActivityAction } from "./enums/activity-action.enum"
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger"

@ApiTags("Activity Tracker")
@Controller("activities")
export class ActivityTrackerController {
  constructor(private readonly activityTrackerService: ActivityTrackerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a new user activity' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Activity successfully logged.', type: Activity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  async logActivity(@Body() createActivityDto: any) {
    return this.activityTrackerService.logActivity(createActivityDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all activities with optional filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of activity entries.', type: [Activity] })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'actionType', required: false, enum: ActivityAction, description: 'Filter by action type' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by activity timestamp (start)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by activity timestamp (end)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by (e.g., timestamp, userId)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order (ASC or DESC)' })
  async findAll(@Query() filterActivityDto: FilterActivityDto) {
    return this.activityTrackerService.findActivities(filterActivityDto);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all activities for a specific user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of activities for the user.', type: [Activity] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found or no activities for user.' })
  @ApiParam({ name: 'userId', type: String, description: 'UUID of the user' })
  async findByUserId(@Param('userId') userId: string) {
    const activities = await this.activityTrackerService.findActivitiesByUserId(userId);
    if (!activities || activities.length === 0) {
      // Depending on requirements, you might throw NotFoundException or return empty array
      // For now, returning empty array if no activities found for user.
      // If you want to distinguish between "user not found" and "user has no activities",
      // you'd need a UserService to check user existence first.
      return [];
    }
    return activities;
  }
}
