import { IsString, MinLength } from 'class-validator';

export class EraseDataDto {
  /** Current password, re-confirmed before anything is deleted. */
  @IsString()
  @MinLength(1)
  password: string;
}
