import { IsString, IsOptional, IsEnum, IsArray, IsEmail } from "class-validator"
import { UserRole, UserStatus } from "../entities/user.entity"

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[]

  @IsOptional()
  metadata?: Record<string, any>
}
