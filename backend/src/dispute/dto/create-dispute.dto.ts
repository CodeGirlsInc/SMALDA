import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { apiContracts } from '../../common/api-contracts';

export class CreateDisputeDto {
  @IsUUID()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(apiContracts.dispute.description.minLength)
  description: string;
}
