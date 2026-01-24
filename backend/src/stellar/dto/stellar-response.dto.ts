import { ApiProperty } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty({ description: 'Public key of the created account' })
  publicKey: string;

  @ApiProperty({ description: 'Secret key of the created account' })
  secretKey: string;
}

export class BalanceResponseDto {
  @ApiProperty({ description: 'Account balance' })
  balance: string;
}

export class FeeEstimateResponseDto {
  @ApiProperty({ description: 'Base fee in stroops' })
  fee: number;

  @ApiProperty({ description: 'Total cost in stroops' })
  cost: string;
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction hash' })
  transactionHash: string;

  @ApiProperty({ description: 'Document hash' })
  documentHash: string;

  @ApiProperty({ description: 'Memo text' })
  memo: string;

  @ApiProperty({ description: 'Transaction status' })
  status: string;

  @ApiProperty({ description: 'Network type' })
  network: string;

  @ApiProperty({ description: 'Transaction fee' })
  fee: string;

  @ApiProperty({ description: 'Source account' })
  sourceAccount: string;

  @ApiProperty({ description: 'Destination account' })
  destinationAccount: string;

  @ApiProperty({ description: 'Horizon URL' })
  horizonUrl: string;

  @ApiProperty({ description: 'Confirmation timestamp' })
  confirmedAt: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class BatchTransactionResponseDto {
  @ApiProperty({ description: 'Array of transaction records' })
  transactions: TransactionResponseDto[];
}

export class VerificationResponseDto {
  @ApiProperty({ description: 'Whether document is verified on Stellar' })
  verified: boolean;
}

export class TransactionStatusResponseDto {
  @ApiProperty({ description: 'Transaction status' })
  status: string;
}
