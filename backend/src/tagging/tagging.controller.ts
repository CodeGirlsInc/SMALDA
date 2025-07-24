import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ConflictException,
} from "@nestjs/common"
import type { TaggingService } from "./tagging.service"
import type { CreateTagDto } from "./dto/create-tag.dto"
import { UpdateTagDto } from "./dto/update-tag.dto"
import type { FilterTagDto } from "./dto/filter-tag.dto"
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from "@nestjs/swagger"
import { Tag } from "./entities/tag.entity"

@ApiTags("Tags")
@Controller("tags")
export class TaggingController {
  constructor(private readonly taggingService: TaggingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new tag" })
  @ApiResponse({ status: HttpStatus.CREATED, description: "Tag successfully created.", type: Tag })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input data." })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: "Tag with this name already exists." })
  create(createTagDto: CreateTagDto) {
    try {
      return this.taggingService.create(createTagDto)
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message)
      }
      throw error
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all tags with optional filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of tags.', type: [Tag] })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for tag name' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by (e.g., name, createdAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order (ASC or DESC)' })
  async findAll(@Query() filterTagDto: FilterTagDto) {
    return this.taggingService.findAll(filterTagDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single tag by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tag found.', type: Tag })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the tag' })
  async findOne(@Param('id') id: string) {
    const tag = await this.taggingService.findOne(id);
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found.`);
    }
    return tag;
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update an existing tag" })
  @ApiResponse({ status: HttpStatus.OK, description: "Tag successfully updated.", type: Tag })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Tag not found." })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input data." })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: "Tag with this name already exists." })
  @ApiParam({ name: "id", type: String, description: "UUID of the tag to update" })
  @ApiBody({ type: UpdateTagDto, description: "Data for updating tag" })
  async update(@Param('id') id: string, updateTagDto: UpdateTagDto) {
    try {
      const updatedTag = await this.taggingService.update(id, updateTagDto)
      if (!updatedTag) {
        throw new NotFoundException(`Tag with ID "${id}" not found.`)
      }
      return updatedTag
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message)
      }
      throw error
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag (soft delete)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Tag successfully deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tag not found.' })
  @ApiParam({ name: 'id', type: String, description: 'UUID of the tag to delete' })
  async remove(@Param('id') id: string) {
    const result = await this.taggingService.remove(id);
    if (!result) {
      throw new NotFoundException(`Tag with ID "${id}" not found.`);
    }
  }
}
