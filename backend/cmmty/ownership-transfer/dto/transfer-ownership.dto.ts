import { IsEmail, IsNotEmpty } from 'class-validator';

export class TransferOwnershipDto {
  @IsEmail()
  @IsNotEmpty()
  toUserEmail: string;
}
