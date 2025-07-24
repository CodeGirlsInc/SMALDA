import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ConflictException,
} from "@nestjs/common"
import type { PropertyOwnerService } from "./property-owner.service"
import type { CreatePropertyOwnerDto } from "./dto/create-property-owner.dto"
import type { UpdatePropertyOwnerDto } from "./dto/update-property-owner.dto"
import type { FilterPropertyOwnerDto } from "./dto/filter-property-owner.dto"
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger"
import { PropertyOwner } from "./entities/property-owner.entity"
import { OwnerType } from "./enums/owner-type.enum"
import { CorporateType } from "./enums/corporate-type.enum"

@ApiTags("Property Owners")
@Controller("property-owners")
export class PropertyOwnerController {
  constructor(private readonly propertyOwnerService: PropertyOwnerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new property owner" })
  @ApiResponse({ status: HttpStatus.CREATED, description: "Property owner successfully created.", type: PropertyOwner })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input data." })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: "Property owner with this email already exists." })
  async create(@Body() createPropertyOwnerDto: CreatePropertyOwnerDto) {
    try {
      return await this.propertyOwnerService.create(createPropertyOwnerDto)
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message)
      }
      throw error
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retrieve all property owners with optional filtering and pagination" })
  @ApiResponse({ status: HttpStatus.OK, description: "List of property owners.", type: [PropertyOwner] })
  @ApiQuery({ name: "ownerType", required: false, enum: OwnerType, description: "Filter by owner type" })
  @ApiQuery({ name: "search", required: false, type: String, description: "Search term for name" })
  @ApiQuery({ name: "email", required: false, type: String, description: "Filter by email address" })
  @ApiQuery({ name: "phoneNumber", required: false, type: String, description: "Filter by phone number" })
  @ApiQuery({ name: "city", required: false, type: String, description: "Filter by city" })
  @ApiQuery({ name: "state", required: false, type: String, description: "Filter by state/province" })
  @ApiQuery({ name: "country", required: false, type: String, description: "Filter by country" })
  @ApiQuery({ name: "corporateType", required: false, enum: CorporateType, description: "Filter by corporate type" })
  @ApiQuery({ name: "isActive", required: false, type: Boolean, description: "Filter by active status" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number for pagination" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Number of items per page" })
  @ApiQuery({ name: "sortBy", required: false, type: String, description: "Field to sort by" })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["ASC", "DESC"], description: "Sort order" })
  async findAll(@Query() filterPropertyOwnerDto: FilterPropertyOwnerDto) {
    return this.propertyOwnerService.findAll(filterPropertyOwnerDto)
  }

  @Get("statistics")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get property owner statistics" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Property owner statistics.",
    schema: {
      type: "object",
      properties: {
        total: { type: "number" },
        individual: { type: "number" },
        corporate: { type: "number" },
        active: { type: "number" },
        inactive: { type: "number" },
      },
    },
  })
  async getStatistics() {
    return this.propertyOwnerService.getStatistics()
  }

  @Get("type/:ownerType")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retrieve property owners by type" })
  @ApiResponse({ status: HttpStatus.OK, description: "List of property owners by type.", type: [PropertyOwner] })
  @ApiParam({ name: "ownerType", enum: OwnerType, description: "Type of owner to filter by" })
  async findByType(@Param("ownerType") ownerType: OwnerType) {
    return this.propertyOwnerService.findByType(ownerType)
  }

  @Get("active")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retrieve all active property owners" })
  @ApiResponse({ status: HttpStatus.OK, description: "List of active property owners.", type: [PropertyOwner] })
  async findActive() {
    return this.propertyOwnerService.findActive()
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retrieve a single property owner by ID" })
  @ApiResponse({ status: HttpStatus.OK, description: "Property owner found.", type: PropertyOwner })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Property owner not found." })
  @ApiParam({ name: "id", type: String, description: "UUID of the property owner" })
  async findOne(@Param("id") id: string) {
    const propertyOwner = await this.propertyOwnerService.findOne(id)
    if (!propertyOwner) {
      throw new NotFoundException(`Property owner with ID "${id}" not found.`)
    }
    return propertyOwner
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update an existing property owner" })
  @ApiResponse({ status: HttpStatus.OK, description: "Property owner successfully updated.", type: PropertyOwner })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Property owner not found." })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input data." })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: "Property owner with this email already exists." })
  @ApiParam({ name: "id", type: String, description: "UUID of the property owner to update" })
  async update(@Param("id") id: string, @Body() updatePropertyOwnerDto: UpdatePropertyOwnerDto) {
    try {
      const updatedPropertyOwner = await this.propertyOwnerService.update(id, updatePropertyOwnerDto)
      if (!updatedPropertyOwner) {
        throw new NotFoundException(`Property owner with ID "${id}" not found.`)
      }
      return updatedPropertyOwner
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message)
      }
      throw error
    }
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a property owner (soft delete)" })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: "Property owner successfully deleted." })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Property owner not found." })
  @ApiParam({ name: "id", type: String, description: "UUID of the property owner to delete" })
  async remove(@Param("id") id: string) {
    const result = await this.propertyOwnerService.remove(id)
    if (!result) {
      throw new NotFoundException(`Property owner with ID "${id}" not found.`)
    }
  }
}
