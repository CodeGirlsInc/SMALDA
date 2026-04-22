import { IsNotEmpty } from 'class-validator';

export class RefreshAuthDto {
  @IsNotEmpty()
  refreshToken: string;
}
