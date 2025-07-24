{
  ;`import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FilterFeedbackDto } from './dto/filter-feedback.dto';
import { CreateFeedbackCommentDto } from './dto/create-feedback-comment.dto';
import { UpdateFeedbackCommentDto } from './dto/update-feedback-comment.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { Feedback } from './entities/feedback.entity';
import { FeedbackComment } from './entities/feedback-comment.entity';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit new feedback' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Feedback successfully submitted.', type: Feedback })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiBody({ type: CreateFeedbackDto, description: 'Data for creating new feedback' })
  async create(@Body() createFeedbackDto: CreateFeedbackDto) {
    return this.feedbackService.create(createFeedbackDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all feedback with optional filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of feedback entries.', type: [Feedback] })
  @ApiQuery({ name: 'feedbackType', required: false, enum: ['bug_report', 'feature_request', 'general_inquiry', 'dispute_insight', 'other'], description: 'Filter by feedback type' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'in_review', 'resolved', 'closed', 'reopened'], description: 'Filter by feedback status' })
  @ApiQuery({ name: 'priority', required: false, enum: ['low', 'medium', 'high', 'critical'], description: 'Filter by feedback priority' })
  @ApiQuery({ name: 'severity', required: false, enum: ['low', 'medium', 'high', 'critical'], description: 'Filter by feedback severity' })
  @ApiQuery({ name: 'source', required: false, enum: ['web_app', 'mobile_app', 'api', 'admin_panel', 'email', 'other'], description: 'Filter by feedback source' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned user ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by creation date (start)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by creation date (end)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by (e.g., createdAt, priority)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order (ASC or DESC)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for subject or message' })
  async findAll(@Query() filterFeedbackDto: FilterFeedbackDto) {
    return this.feedbackService.findAll(filterFeedbackDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single feedback entry by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feedback entry found.', type: Feedback })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the feedback entry' })
  async findOne(@Param('id') id: string) {
    const feedback = await this.feedbackService.findOne(id);
    if (!feedback) {
      throw new NotFoundException(\`Feedback with ID "\${id}" not found.\`);
    }
    return feedback;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing feedback entry' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feedback successfully updated.', type: Feedback })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the feedback entry' })
  @ApiBody({ type: UpdateFeedbackDto, description: 'Data for updating feedback' })
  async update(@Param('id') id: string, @Body() updateFeedbackDto: UpdateFeedbackDto) {
    const updatedFeedback = await this.feedbackService.update(id, updateFeedbackDto);
    if (!updatedFeedback) {
      throw new NotFoundException(\`Feedback with ID "\${id}" not found.\`);
    }
    return updatedFeedback;
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a feedback entry as resolved' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feedback successfully resolved.', type: Feedback })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the feedback entry' })
  @ApiBody({ schema: { type: 'object', properties: { resolvedBy: { type: 'string', description: 'ID of the user who resolved the feedback' }, resolutionNotes: { type: 'string', description: 'Notes on resolution' } } }, description: 'User ID who resolved the feedback and resolution notes' })
  async resolve(@Param('id') id: string, @Body('resolvedBy') resolvedBy: string, @Body('resolutionNotes') resolutionNotes?: string) {
    if (!resolvedBy) {
      throw new BadRequestException('resolvedBy is required to resolve feedback.');
    }
    const resolvedFeedback = await this.feedbackService.resolve(id, resolvedBy, resolutionNotes);
    if (!resolvedFeedback) {
      throw new NotFoundException(\`Feedback with ID "\${id}" not found.\`);
    }
    return resolvedFeedback;
  }

  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign feedback to a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feedback successfully assigned.', type: Feedback })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the feedback entry' })
  @ApiBody({ schema: { type: 'object', properties: { assignedTo: { type: 'string', description: 'ID of the user to assign the feedback to' } } }, description: 'User ID to assign the feedback to' })
  async assign(@Param('id') id: string, @Body('assignedTo') assignedTo: string) {
    if (!assignedTo) {
      throw new BadRequestException('assignedTo is required for assignment.');
    }
    const assignedFeedback = await this.feedbackService.assignFeedback(id, assignedTo);
    if (!assignedFeedback) {
      throw new NotFoundException(\`Feedback with ID "\${id}" not found.\`);
    }
    return assignedFeedback;
  }

  @Patch(':id/unassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unassign feedback from a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Feedback successfully unassigned.', type: Feedback })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the feedback entry' })
  async unassign(@Param('id') id: string) {
    const unassignedFeedback = await this.feedbackService.unassignFeedback(id);
    if (!unassignedFeedback) {
      throw new NotFoundException(\`Feedback with ID "\${id}" not found.\`);
    }
    return unassignedFeedback;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feedback entry (soft delete)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Feedback successfully deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the feedback entry' })
  async remove(@Param('id') id: string) {
    const result = await this.feedbackService.remove(id);
    if (!result) {
      throw new NotFoundException(\`Feedback with ID "\${id}" not found.\`);
    }
  }

  // --- Feedback Comments Endpoints ---

  @Post(':feedbackId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a feedback entry' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Comment successfully added.', type: FeedbackComment })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiParam({ name: 'feedbackId', type: String, description: 'UUID of the feedback entry' })
  @ApiBody({ type: CreateFeedbackCommentDto, description: 'Data for creating a new comment' })
  async addComment(@Param('feedbackId') feedbackId: string, @Body() createCommentDto: CreateFeedbackCommentDto) {
    const feedback = await this.feedbackService.findOne(feedbackId);
    if (!feedback) {
      throw new NotFoundException(\`Feedback with ID "\${feedbackId}" not found.\`);
    }
    return this.feedbackService.createComment(feedbackId, createCommentDto);
  }

  @Get(':feedbackId/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all comments for a specific feedback entry' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of comments for the feedback.', type: [FeedbackComment] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback not found.' })
  @ApiParam({ name: 'feedbackId', type: String, description: 'UUID of the feedback entry' })
  async getComments(@Param('feedbackId') feedbackId: string) {
    const feedback = await this.feedbackService.findOne(feedbackId);
    if (!feedback) {
      throw new NotFoundException(\`Feedback with ID "\${feedbackId}" not found.\`);
    }
    return this.feedbackService.findCommentsByFeedbackId(feedbackId);
  }

  @Patch(':feedbackId/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a specific comment for a feedback entry' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Comment successfully updated.', type: FeedbackComment })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback or comment not found.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiParam({ name: 'feedbackId', type: String, description: 'UUID of the feedback entry' })
  @ApiParam({ name: 'commentId', type: String, description: 'UUID of the comment to update' })
  @ApiBody({ type: UpdateFeedbackCommentDto, description: 'Data for updating the comment' })
  async updateComment(
    @Param('feedbackId') feedbackId: string,
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdateFeedbackCommentDto,
  ) {
    const updatedComment = await this.feedbackService.updateComment(feedbackId, commentId, updateCommentDto);
    if (!updatedComment) {
      throw new NotFoundException(\`Comment with ID "\${commentId}" not found for feedback "\${feedbackId}".\`);
    }
    return updatedComment;
  }

  @Delete(':feedbackId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a specific comment from a feedback entry' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Comment successfully deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feedback or comment not found.' })
  @ApiParam({ name: 'feedbackId', type: String, description: 'UUID of the feedback entry' })
  @ApiParam({ name: 'commentId', type: String, description: 'UUID of the comment to delete' })
  async removeComment(@Param('feedbackId') feedbackId: string, @Param('commentId') commentId: string) {
    const result = await this.feedbackService.removeComment(feedbackId, commentId);
    if (!result) {
      throw new NotFoundException(\`Comment with ID "\${commentId}" not found for feedback "\${feedbackId}".\`);
    }
  }
}`
}
