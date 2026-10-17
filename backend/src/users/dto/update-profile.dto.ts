import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  preferredLanguage?: string;
}
