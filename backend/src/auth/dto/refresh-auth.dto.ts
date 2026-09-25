import { IsOptional, IsString } from 'class-validator';

export class RefreshAuthDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
