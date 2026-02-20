import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordAnchorDto {
  @ApiProperty({
    description: 'The Stellar transaction ID confirming the document has been anchored on-chain',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  stellarTransactionId: string;
}
