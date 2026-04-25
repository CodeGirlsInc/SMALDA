import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;
}