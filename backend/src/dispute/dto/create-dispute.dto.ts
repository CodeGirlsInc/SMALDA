import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { apiContracts } from '../../common/api-contracts';

export class CreateDisputeDto {
  @IsUUID()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(apiContracts.dispute.description.minLength)
  @MaxLength(apiContracts.dispute.description.maxLength)
  description: string;
}
