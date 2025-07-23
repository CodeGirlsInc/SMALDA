import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum, IsArray, MinLength } from "class-validator"
import { UserRole, UserStatus } from "../entities/user.entity"

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  @IsNotEmpty()
  firstName: string

  @IsString()
  @IsNotEmpty()
  lastName: string

  @IsString()
  @MinLength(8)
  password: string

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.USER

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus = UserStatus.ACTIVE

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
