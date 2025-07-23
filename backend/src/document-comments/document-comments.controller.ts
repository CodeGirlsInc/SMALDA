import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from "@nestjs/common"
import type { DocumentCommentsService } from "./document-comments.service"
import type { CreateCommentDto } from "./dto/create-comment.dto"
import type { UpdateCommentDto } from "./dto/update-comment.dto"
import type { FilterCommentsDto } from "./dto/filter-comments.dto"
import type { CommentResponseDto, PaginatedCommentsDto } from "./dto/comment-response.dto"

// Uncomment and modify based on your authentication setup
// @UseGuards(JwtAuthGuard)
@Controller("document-comments")
export class DocumentCommentsController {
  constructor(private readonly documentCommentsService: DocumentCommentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(createCommentDto: CreateCommentDto): Promise<CommentResponseDto> {
    return this.documentCommentsService.create(createCommentDto)
  }

  @Get("document/:documentId")
  async findAllByDocument(
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Query() filterDto: Omit<FilterCommentsDto, "documentId">,
  ): Promise<PaginatedCommentsDto> {
    return this.documentCommentsService.findAllByDocument({ ...filterDto, documentId })
  }

  @Get("document/:documentId/stats")
  async getDocumentStats(@Param("documentId", ParseUUIDPipe) documentId: string) {
    return this.documentCommentsService.getCommentStats(documentId)
  }

  @Get("author/:authorId")
  async findByAuthor(
    @Param("authorId", ParseUUIDPipe) authorId: string,
    @Query("limit") limit?: number,
  ): Promise<CommentResponseDto[]> {
    return this.documentCommentsService.getCommentsByAuthor(authorId, limit)
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("includeDeleted") includeDeleted?: boolean,
  ): Promise<CommentResponseDto> {
    return this.documentCommentsService.findOne(id, includeDeleted)
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req: any, // Replace with your user type
  ): Promise<CommentResponseDto> {
    // Extract user ID from request (adjust based on your auth implementation)
    const userId = req.user?.id || req.user?.sub
    return this.documentCommentsService.update(id, updateCommentDto, userId)
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("hardDelete") hardDelete?: boolean,
    @Request() req: any, // Replace with your user type
  ): Promise<void> {
    // Extract user ID from request (adjust based on your auth implementation)
    const userId = req.user?.id || req.user?.sub
    return this.documentCommentsService.remove(id, userId, hardDelete)
  }
}
