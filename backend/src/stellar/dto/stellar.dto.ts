import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NetworkType } from '../entities/stellar-transaction.entity';

export class CreateAccountDto {
  @ApiPropertyOptional({ 
    enum: NetworkType,
    default: NetworkType.TESTNET,
    description: 'Network to create account on'
  })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType = NetworkType.TESTNET;
}

export class FundAccountDto {
  @ApiProperty({ description: 'Public key of the account to fund' })
  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @ApiPropertyOptional({ 
    enum: NetworkType,
    default: NetworkType.TESTNET,
    description: 'Network to fund account on'
  })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType = NetworkType.TESTNET;
}

export class AnchorDocumentDto {
  @ApiProperty({ description: 'Public key of the source account' })
  @IsString()
  @IsNotEmpty()
  sourcePublicKey: string;

  @ApiProperty({ description: 'Secret key of the source account' })
  @IsString()
  @IsNotEmpty()
  sourceSecretKey: string;

  @ApiProperty({ description: 'Document hash to anchor' })
  @IsString()
  @IsNotEmpty()
  documentHash: string;

  @ApiPropertyOptional({ 
    enum: NetworkType,
    default: NetworkType.TESTNET,
    description: 'Network to anchor on'
  })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType = NetworkType.TESTNET;
}

export class BatchAnchorDocumentsDto {
  @ApiProperty({ description: 'Public key of the source account' })
  @IsString()
  @IsNotEmpty()
  sourcePublicKey: string;

  @ApiProperty({ description: 'Secret key of the source account' })
  @IsString()
  @IsNotEmpty()
  sourceSecretKey: string;

  @ApiProperty({ 
    description: 'Array of document hashes to anchor',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  documentHashes: string[];

  @ApiPropertyOptional({ 
    enum: NetworkType,
    default: NetworkType.TESTNET,
    description: 'Network to anchor on'
  })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType = NetworkType.TESTNET;
}

export class EstimateFeeDto {
  @ApiProperty({ description: 'Public key of the source account' })
  @IsString()
  @IsNotEmpty()
  sourcePublicKey: string;

  @ApiProperty({ description: 'Document hash to estimate fee for' })
  @IsString()
  @IsNotEmpty()
  documentHash: string;

  @ApiPropertyOptional({ 
    enum: NetworkType,
    default: NetworkType.TESTNET,
    description: 'Network to estimate fee on'
  })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType = NetworkType.TESTNET;
}

export class VerifyDocumentDto {
  @ApiProperty({ description: 'Document hash to verify' })
  @IsString()
  @IsNotEmpty()
  documentHash: string;

  @ApiPropertyOptional({ 
    enum: NetworkType,
    default: NetworkType.TESTNET,
    description: 'Network to verify on'
  })
  @IsEnum(NetworkType)
  @IsOptional()
  network?: NetworkType = NetworkType.TESTNET;
}

export class GetTransactionDto {
  @ApiProperty({ description: 'Transaction hash' })
  @IsString()
  @IsNotEmpty()
  transactionHash: string;
}

export class GetTransactionsByDocumentDto {
  @ApiProperty({ description: 'Document hash' })
  @IsString()
  @IsNotEmpty()
  documentHash: string;
}
