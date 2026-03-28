import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RefreshAuthDto {
  @ApiProperty({ description: 'JWT refresh token' })
  @IsNotEmpty()
  refreshToken: string;
}
