import { Injectable, ConflictException } from "@nestjs/common"
import { type Repository, IsNull } from "typeorm"
import type { PropertyOwner } from "./entities/property-owner.entity"
import type { CreatePropertyOwnerDto } from "./dto/create-property-owner.dto"
import type { UpdatePropertyOwnerDto } from "./dto/update-property-owner.dto"
import type { FilterPropertyOwnerDto } from "./dto/filter-property-owner.dto"
import { OwnerType } from "./enums/owner-type.enum"

@Injectable()
export class PropertyOwnerService {
  constructor(private propertyOwnerRepository: Repository<PropertyOwner>) {}

  /**
   * Creates a new property owner.
   * @param createPropertyOwnerDto The DTO containing property owner data.
   * @returns The created property owner entity.
   * @throws ConflictException if an owner with the same email already exists.
   */
  async create(createPropertyOwnerDto: CreatePropertyOwnerDto): Promise<PropertyOwner> {
    // Check for existing owner with same email
    const existingOwner = await this.propertyOwnerRepository.findOne({
      where: { email: createPropertyOwnerDto.email, deletedAt: IsNull() },
    })
    if (existingOwner) {
      throw new ConflictException(`Property owner with email "${createPropertyOwnerDto.email}" already exists.`)
    }

    // Convert date strings to Date objects
    const ownerData = {
      ...createPropertyOwnerDto,
      dateOfBirth: createPropertyOwnerDto.dateOfBirth ? new Date(createPropertyOwnerDto.dateOfBirth) : undefined,
      incorporationDate: createPropertyOwnerDto.incorporationDate
        ? new Date(createPropertyOwnerDto.incorporationDate)
        : undefined,
      country: createPropertyOwnerDto.country || "Nigeria",
      isActive: createPropertyOwnerDto.isActive ?? true,
    }

    const propertyOwner = this.propertyOwnerRepository.create(ownerData)
    return this.propertyOwnerRepository.save(propertyOwner)
  }

  /**
   * Retrieves all property owners with optional filtering, pagination, and sorting.
   * @param filterDto The DTO containing filter, pagination, and sort parameters.
   * @returns An object containing property owners and total count.
   */
  async findAll(filterDto: FilterPropertyOwnerDto): Promise<{ data: PropertyOwner[]; total: number }> {
    const {
      ownerType,
      search,
      email,
      phoneNumber,
      city,
      state,
      country,
      corporateType,
      isActive,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = filterDto

    const queryBuilder = this.propertyOwnerRepository.createQueryBuilder("owner")
    queryBuilder.where("owner.deletedAt IS NULL")

    // Apply filters
    if (ownerType) {
      queryBuilder.andWhere("owner.ownerType = :ownerType", { ownerType })
    }
    if (search) {
      queryBuilder.andWhere(
        "(owner.firstName ILIKE :search OR owner.lastName ILIKE :search OR owner.companyName ILIKE :search)",
        { search: `%${search}%` },
      )
    }
    if (email) {
      queryBuilder.andWhere("owner.email ILIKE :email", { email: `%${email}%` })
    }
    if (phoneNumber) {
      queryBuilder.andWhere("(owner.phoneNumber ILIKE :phoneNumber OR owner.alternatePhoneNumber ILIKE :phoneNumber)", {
        phoneNumber: `%${phoneNumber}%`,
      })
    }
    if (city) {
      queryBuilder.andWhere("owner.city ILIKE :city", { city: `%${city}%` })
    }
    if (state) {
      queryBuilder.andWhere("owner.state ILIKE :state", { state: `%${state}%` })
    }
    if (country) {
      queryBuilder.andWhere("owner.country ILIKE :country", { country: `%${country}%` })
    }
    if (corporateType) {
      queryBuilder.andWhere("owner.corporateType = :corporateType", { corporateType })
    }
    if (isActive !== undefined) {
      queryBuilder.andWhere("owner.isActive = :isActive", { isActive })
    }

    queryBuilder.orderBy(`owner.${sortBy}`, sortOrder)
    queryBuilder.skip((page - 1) * limit).take(limit)

    const [data, total] = await queryBuilder.getManyAndCount()
    return { data, total }
  }

  /**
   * Retrieves a single property owner by its ID.
   * @param id The UUID of the property owner.
   * @returns The property owner entity or undefined if not found.
   */
  async findOne(id: string): Promise<PropertyOwner | undefined> {
    return this.propertyOwnerRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["documents"], // Eager load associated documents
    })
  }

  /**
   * Retrieves a property owner by email address.
   * @param email The email address of the property owner.
   * @returns The property owner entity or undefined if not found.
   */
  async findByEmail(email: string): Promise<PropertyOwner | undefined> {
    return this.propertyOwnerRepository.findOne({
      where: { email, deletedAt: IsNull() },
    })
  }

  /**
   * Updates an existing property owner.
   * @param id The UUID of the property owner.
   * @param updatePropertyOwnerDto The DTO containing updated property owner data.
   * @returns The updated property owner entity or undefined if not found.
   * @throws ConflictException if the new email already exists for another owner.
   */
  async update(id: string, updatePropertyOwnerDto: UpdatePropertyOwnerDto): Promise<PropertyOwner | undefined> {
    const propertyOwner = await this.findOne(id)
    if (!propertyOwner) {
      return undefined
    }

    // Check for email conflict if email is being updated
    if (updatePropertyOwnerDto.email && updatePropertyOwnerDto.email !== propertyOwner.email) {
      const existingOwnerWithEmail = await this.propertyOwnerRepository.findOne({
        where: { email: updatePropertyOwnerDto.email, deletedAt: IsNull() },
      })
      if (existingOwnerWithEmail && existingOwnerWithEmail.id !== id) {
        throw new ConflictException(`Property owner with email "${updatePropertyOwnerDto.email}" already exists.`)
      }
    }

    // Convert date strings to Date objects
    const updateData = {
      ...updatePropertyOwnerDto,
      dateOfBirth: updatePropertyOwnerDto.dateOfBirth ? new Date(updatePropertyOwnerDto.dateOfBirth) : undefined,
      incorporationDate: updatePropertyOwnerDto.incorporationDate
        ? new Date(updatePropertyOwnerDto.incorporationDate)
        : undefined,
    }

    Object.assign(propertyOwner, updateData)
    return this.propertyOwnerRepository.save(propertyOwner)
  }

  /**
   * Soft deletes a property owner.
   * @param id The UUID of the property owner.
   * @returns True if deleted, false if not found.
   */
  async remove(id: string): Promise<boolean> {
    const result = await this.propertyOwnerRepository.softDelete(id)
    return result.affected > 0
  }

  /**
   * Retrieves property owners by type (individual or corporate).
   * @param ownerType The type of owner to filter by.
   * @returns An array of property owners of the specified type.
   */
  async findByType(ownerType: OwnerType): Promise<PropertyOwner[]> {
    return this.propertyOwnerRepository.find({
      where: { ownerType, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    })
  }

  /**
   * Retrieves active property owners.
   * @returns An array of active property owners.
   */
  async findActive(): Promise<PropertyOwner[]> {
    return this.propertyOwnerRepository.find({
      where: { isActive: true, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    })
  }

  /**
   * Gets statistics about property owners.
   * @returns An object containing various statistics.
   */
  async getStatistics(): Promise<{
    total: number
    individual: number
    corporate: number
    active: number
    inactive: number
  }> {
    const [total, individual, corporate, active, inactive] = await Promise.all([
      this.propertyOwnerRepository.count({ where: { deletedAt: IsNull() } }),
      this.propertyOwnerRepository.count({ where: { ownerType: OwnerType.INDIVIDUAL, deletedAt: IsNull() } }),
      this.propertyOwnerRepository.count({ where: { ownerType: OwnerType.CORPORATE, deletedAt: IsNull() } }),
      this.propertyOwnerRepository.count({ where: { isActive: true, deletedAt: IsNull() } }),
      this.propertyOwnerRepository.count({ where: { isActive: false, deletedAt: IsNull() } }),
    ])

    return { total, individual, corporate, active, inactive }
  }
}
