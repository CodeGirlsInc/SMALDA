import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { StellarService } from './stellar.service';
import {
  CreateAccountDto,
  FundAccountDto,
  AnchorDocumentDto,
  BatchAnchorDocumentsDto,
  EstimateFeeDto,
  VerifyDocumentDto,
  GetTransactionDto,
  GetTransactionsByDocumentDto,
} from './dto/stellar.dto';
import {
  AccountResponseDto,
  BalanceResponseDto,
  FeeEstimateResponseDto,
  TransactionResponseDto,
  BatchTransactionResponseDto,
  VerificationResponseDto,
  TransactionStatusResponseDto,
} from './dto/stellar-response.dto';

@ApiTags('stellar')
@Controller('stellar')
@UseGuards(ThrottlerGuard)
export class StellarController {
  private readonly logger = new Logger(StellarController.name);

  constructor(private readonly stellarService: StellarService) {}

  @Post('accounts')
  @ApiOperation({ summary: 'Create a new Stellar account' })
  @ApiResponse({ status: 201, description: 'Account created successfully', type: AccountResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createAccount(@Body(ValidationPipe) createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    this.logger.log(`Creating account on network: ${createAccountDto.network}`);
    const account = await this.stellarService.createAccount(createAccountDto.network);
    return account;
  }

  @Post('accounts/fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fund a Stellar account (testnet only)' })
  @ApiResponse({ status: 200, description: 'Account funded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or mainnet funding attempted' })
  async fundAccount(@Body(ValidationPipe) fundAccountDto: FundAccountDto): Promise<{ message: string }> {
    this.logger.log(`Funding account ${fundAccountDto.publicKey} on network: ${fundAccountDto.network}`);
    await this.stellarService.fundAccount(fundAccountDto.publicKey, fundAccountDto.network);
    return { message: 'Account funded successfully' };
  }

  @Get('accounts/:publicKey/balance')
  @ApiOperation({ summary: 'Get account balance' })
  @ApiParam({ name: 'publicKey', description: 'Public key of the account' })
  @ApiQuery({ name: 'network', enum: ['testnet', 'mainnet'], required: false })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully', type: BalanceResponseDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getBalance(
    @Param('publicKey') publicKey: string,
    @Query('network') network: string = 'testnet',
  ): Promise<BalanceResponseDto> {
    this.logger.log(`Getting balance for account ${publicKey} on ${network}`);
    const balance = await this.stellarService.getAccountBalance(publicKey, network as any);
    return { balance };
  }

  @Post('estimate-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate transaction fee' })
  @ApiResponse({ status: 200, description: 'Fee estimated successfully', type: FeeEstimateResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async estimateFee(@Body(ValidationPipe) estimateFeeDto: EstimateFeeDto): Promise<FeeEstimateResponseDto> {
    this.logger.log(`Estimating fee for document hash ${estimateFeeDto.documentHash}`);
    const estimate = await this.stellarService.estimateTransactionFee(
      estimateFeeDto.sourcePublicKey,
      estimateFeeDto.documentHash,
      estimateFeeDto.network,
    );
    return estimate;
  }

  @Post('anchor')
  @ApiOperation({ summary: 'Anchor a document hash on Stellar' })
  @ApiResponse({ status: 201, description: 'Document anchored successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Transaction failed' })
  async anchorDocument(@Body(ValidationPipe) anchorDocumentDto: AnchorDocumentDto): Promise<TransactionResponseDto> {
    this.logger.log(`Anchoring document hash ${anchorDocumentDto.documentHash}`);
    const transaction = await this.stellarService.anchorDocumentHash(
      anchorDocumentDto.sourcePublicKey,
      anchorDocumentDto.sourceSecretKey,
      anchorDocumentDto.documentHash,
      anchorDocumentDto.network,
    );
    return transaction as TransactionResponseDto;
  }

  @Post('anchor/batch')
  @ApiOperation({ summary: 'Anchor multiple document hashes on Stellar' })
  @ApiResponse({ status: 201, description: 'Documents anchored successfully', type: BatchTransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Transaction failed' })
  async batchAnchorDocuments(@Body(ValidationPipe) batchAnchorDto: BatchAnchorDocumentsDto): Promise<BatchTransactionResponseDto> {
    this.logger.log(`Batch anchoring ${batchAnchorDto.documentHashes.length} document hashes`);
    const transactions = await this.stellarService.batchAnchorDocuments(
      batchAnchorDto.sourcePublicKey,
      batchAnchorDto.sourceSecretKey,
      batchAnchorDto.documentHashes,
      batchAnchorDto.network,
    );
    return { transactions: transactions as TransactionResponseDto[] };
  }

  @Get('transactions/:transactionHash/status')
  @ApiOperation({ summary: 'Poll transaction status' })
  @ApiParam({ name: 'transactionHash', description: 'Transaction hash' })
  @ApiQuery({ name: 'network', enum: ['testnet', 'mainnet'], required: false })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully', type: TransactionStatusResponseDto })
  async pollTransactionStatus(
    @Param('transactionHash') transactionHash: string,
    @Query('network') network: string = 'testnet',
  ): Promise<TransactionStatusResponseDto> {
    this.logger.log(`Polling status for transaction ${transactionHash} on ${network}`);
    const status = await this.stellarService.pollTransactionStatus(transactionHash, network as any);
    return { status };
  }

  @Get('transactions/:transactionHash')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiParam({ name: 'transactionHash', description: 'Transaction hash' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@Param('transactionHash') transactionHash: string): Promise<TransactionResponseDto> {
    this.logger.log(`Getting transaction ${transactionHash}`);
    const transaction = await this.stellarService.getTransaction(transactionHash);
    return transaction as TransactionResponseDto;
  }

  @Get('transactions/document/:documentHash')
  @ApiOperation({ summary: 'Get transactions by document hash' })
  @ApiParam({ name: 'documentHash', description: 'Document hash' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully', type: [TransactionResponseDto] })
  async getTransactionsByDocumentHash(@Param('documentHash') documentHash: string): Promise<TransactionResponseDto[]> {
    this.logger.log(`Getting transactions for document hash ${documentHash}`);
    const transactions = await this.stellarService.getTransactionsByDocumentHash(documentHash);
    return transactions as TransactionResponseDto[];
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify document hash on Stellar' })
  @ApiResponse({ status: 200, description: 'Verification completed', type: VerificationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async verifyDocument(@Body(ValidationPipe) verifyDocumentDto: VerifyDocumentDto): Promise<VerificationResponseDto> {
    this.logger.log(`Verifying document hash ${verifyDocumentDto.documentHash} on ${verifyDocumentDto.network}`);
    const verified = await this.stellarService.verifyDocumentOnStellar(
      verifyDocumentDto.documentHash,
      verifyDocumentDto.network,
    );
    return { verified };
  }
}
