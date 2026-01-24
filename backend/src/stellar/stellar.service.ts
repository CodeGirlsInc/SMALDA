import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Horizon, TransactionBuilder, Keypair, Networks, Operation, Asset, BASE_FEE, Memo } from 'stellar-sdk';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarTransaction, TransactionStatus, NetworkType } from './entities/stellar-transaction.entity';
import { StellarAccount } from './entities/stellar-account.entity';
import { StellarConfig } from './config/stellar.config';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(StellarTransaction)
    private transactionRepository: Repository<StellarTransaction>,
    @InjectRepository(StellarAccount)
    private accountRepository: Repository<StellarAccount>,
  ) {}

  private getServer(network: NetworkType): Horizon.Server {
    const config = this.configService.get<StellarConfig>('stellar');
    const horizonUrl = network === NetworkType.TESTNET ? config.testnet.horizonUrl : config.mainnet.horizonUrl;
    return new Horizon.Server(horizonUrl);
  }

  private getNetworkPassphrase(network: NetworkType): string {
    const config = this.configService.get<StellarConfig>('stellar');
    return network === NetworkType.TESTNET ? config.testnet.networkPassphrase : config.mainnet.networkPassphrase;
  }

  async createAccount(network: NetworkType = NetworkType.TESTNET): Promise<{ publicKey: string; secretKey: string }> {
    this.logger.log(`Creating new Stellar account on ${network}`);
    
    const pair = Keypair.random();
    const publicKey = pair.publicKey();
    const secretKey = pair.secret();
    
    const account = this.accountRepository.create({
      publicKey,
      encryptedSecretKey: secretKey, // In production, encrypt this
      network,
      isFunded: false,
    });
    
    await this.accountRepository.save(account);
    
    this.logger.log(`Created account ${publicKey} on ${network}`);
    return { publicKey, secretKey };
  }

  async fundAccount(publicKey: string, network: NetworkType = NetworkType.TESTNET): Promise<void> {
    this.logger.log(`Funding account ${publicKey} on ${network}`);
    
    if (network !== NetworkType.TESTNET) {
      throw new Error('Account funding is only available on testnet');
    }
    
    const config = this.configService.get<StellarConfig>('stellar');
    const friendbotUrl = `${config.testnet.friendbotUrl}?addr=${publicKey}`;
    
    try {
      const response = await fetch(friendbotUrl);
      if (!response.ok) {
        throw new Error(`Friendbot request failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      this.logger.log(`Successfully funded account ${publicKey}`);
      
      await this.accountRepository.update(
        { publicKey, network },
        { 
          isFunded: true, 
          lastFundedAt: new Date(),
          balance: result.result.account_balance 
        }
      );
    } catch (error) {
      this.logger.error(`Failed to fund account ${publicKey}:`, error);
      throw error;
    }
  }

  async getAccountBalance(publicKey: string, network: NetworkType): Promise<string> {
    const server = this.getServer(network);
    const account = await server.loadAccount(publicKey);
    return account.balances[0].balance;
  }

  async estimateTransactionFee(
    sourcePublicKey: string,
    documentHash: string,
    network: NetworkType = NetworkType.TESTNET
  ): Promise<{ fee: number; cost: string }> {
    const server = this.getServer(network);
    const sourceAccount = await server.loadAccount(sourcePublicKey);
    
    const config = this.configService.get<StellarConfig>('stellar');
    const fee = config.fee.base;
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: fee.toString(),
      networkPassphrase: this.getNetworkPassphrase(network),
    })
      .addOperation(Operation.payment({
        destination: sourcePublicKey, // Self-payment for memo
        asset: Asset.native(),
        amount: '0.00001', // Minimum amount
      }))
      .addMemo(Memo.text(documentHash))
      .setTimeout(30)
      .build();
    
    return {
      fee,
      cost: (fee * transaction.operations.length).toString(),
    };
  }

  async anchorDocumentHash(
    sourcePublicKey: string,
    sourceSecretKey: string,
    documentHash: string,
    network: NetworkType = NetworkType.TESTNET
  ): Promise<StellarTransaction> {
    this.logger.log(`Anchoring document hash ${documentHash} on ${network}`);
    
    const server = this.getServer(network);
    const sourceAccount = await server.loadAccount(sourcePublicKey);
    
    const config = this.configService.get<StellarConfig>('stellar');
    const fee = config.fee.base;
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: fee.toString(),
      networkPassphrase: this.getNetworkPassphrase(network),
    })
      .addOperation(Operation.payment({
        destination: sourcePublicKey,
        asset: Asset.native(),
        amount: '0.00001',
      }))
      .addMemo(Memo.text(documentHash))
      .setTimeout(30)
      .build();
    
    const keypair = Keypair.fromSecret(sourceSecretKey);
    transaction.sign(keypair);
    
    const transactionRecord = this.transactionRepository.create({
      transactionHash: transaction.hash().toString('hex'),
      documentHash,
      memo: documentHash,
      status: TransactionStatus.PENDING,
      network,
      fee: fee.toString(),
      sourceAccount: sourcePublicKey,
      destinationAccount: sourcePublicKey,
      horizonUrl: server.serverURL.toString(),
      transactionData: transaction.toXDR(),
    });
    
    await this.transactionRepository.save(transactionRecord);
    
    try {
      const result = await server.submitTransaction(transaction);
      
      await this.transactionRepository.update(transactionRecord.id, {
        status: TransactionStatus.SUCCESS,
        confirmedAt: new Date(),
        transactionData: JSON.stringify(result),
      });
      
      this.logger.log(`Successfully anchored document hash ${documentHash} with transaction ${result.hash}`);
      return await this.transactionRepository.findOne({ where: { id: transactionRecord.id } });
      
    } catch (error) {
      this.logger.error(`Failed to anchor document hash ${documentHash}:`, error);
      
      await this.transactionRepository.update(transactionRecord.id, {
        status: TransactionStatus.FAILED,
        errorData: JSON.stringify(error),
      });
      
      throw error;
    }
  }

  async batchAnchorDocuments(
    sourcePublicKey: string,
    sourceSecretKey: string,
    documentHashes: string[],
    network: NetworkType = NetworkType.TESTNET
  ): Promise<StellarTransaction[]> {
    this.logger.log(`Batch anchoring ${documentHashes.length} document hashes on ${network}`);
    
    const server = this.getServer(network);
    const sourceAccount = await server.loadAccount(sourcePublicKey);
    
    const config = this.configService.get<StellarConfig>('stellar');
    const fee = config.fee.base;
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: fee.toString(),
      networkPassphrase: this.getNetworkPassphrase(network),
    });
    
    documentHashes.forEach(documentHash => {
      transaction.addOperation(Operation.payment({
        destination: sourcePublicKey,
        asset: Asset.native(),
        amount: '0.00001',
      }));
    });
    
    // Add memo for the first document hash (Stellar only supports one memo per transaction)
    if (documentHashes.length > 0) {
      transaction.addMemo(Memo.text(documentHashes[0]));
    }
    
    transaction.setTimeout(30);
    const builtTransaction = transaction.build();
    
    const keypair = Keypair.fromSecret(sourceSecretKey);
    builtTransaction.sign(keypair);
    
    const transactionRecords = documentHashes.map(documentHash => 
      this.transactionRepository.create({
        transactionHash: builtTransaction.hash().toString('hex'),
        documentHash,
        memo: documentHash,
        status: TransactionStatus.PENDING,
        network,
        fee: fee.toString(),
        sourceAccount: sourcePublicKey,
        destinationAccount: sourcePublicKey,
        horizonUrl: server.serverURL.toString(),
        transactionData: builtTransaction.toXDR(),
      })
    );
    
    await this.transactionRepository.save(transactionRecords);
    
    try {
      const result = await server.submitTransaction(builtTransaction);
      
      await this.transactionRepository.update(
        { transactionHash: result.hash },
        {
          status: TransactionStatus.SUCCESS,
          confirmedAt: new Date(),
          transactionData: JSON.stringify(result),
        }
      );
      
      this.logger.log(`Successfully batch anchored ${documentHashes.length} document hashes`);
      return await this.transactionRepository.find({ 
        where: { transactionHash: result.hash } 
      });
      
    } catch (error) {
      this.logger.error(`Failed to batch anchor documents:`, error);
      
      await this.transactionRepository.update(
        { transactionHash: builtTransaction.hash().toString('hex') },
        {
          status: TransactionStatus.FAILED,
          errorData: JSON.stringify(error),
        }
      );
      
      throw error;
    }
  }

  async pollTransactionStatus(transactionHash: string, network: NetworkType): Promise<TransactionStatus> {
    const server = this.getServer(network);
    const config = this.configService.get<StellarConfig>('stellar');
    
    const startTime = Date.now();
    const timeout = config.timeouts.confirmation;
    
    while (Date.now() - startTime < timeout) {
      try {
        const transaction = await server.transactions().transaction(transactionHash).call();
        
        if (transaction.successful) {
          await this.transactionRepository.update(
            { transactionHash },
            { 
              status: TransactionStatus.SUCCESS,
              confirmedAt: new Date(),
              transactionData: JSON.stringify(transaction),
            }
          );
          return TransactionStatus.SUCCESS;
        } else {
          await this.transactionRepository.update(
            { transactionHash },
            { 
              status: TransactionStatus.FAILED,
              errorData: JSON.stringify(transaction),
            }
          );
          return TransactionStatus.FAILED;
        }
      } catch (error) {
        // Transaction not found yet, continue polling
        await new Promise(resolve => setTimeout(resolve, config.timeouts.polling));
      }
    }
    
    await this.transactionRepository.update(
      { transactionHash },
      { status: TransactionStatus.TIMEOUT }
    );
    
    return TransactionStatus.TIMEOUT;
  }

  async getTransaction(transactionHash: string): Promise<StellarTransaction> {
    return this.transactionRepository.findOne({ 
      where: { transactionHash },
      relations: ['account']
    });
  }

  async getTransactionsByDocumentHash(documentHash: string): Promise<StellarTransaction[]> {
    return this.transactionRepository.find({ 
      where: { documentHash },
      order: { createdAt: 'DESC' }
    });
  }

  async verifyDocumentOnStellar(documentHash: string, network: NetworkType): Promise<boolean> {
    const transactions = await this.getTransactionsByDocumentHash(documentHash);
    const networkTransactions = transactions.filter(tx => tx.network === network);
    
    if (networkTransactions.length === 0) {
      return false;
    }
    
    const server = this.getServer(network);
    
    for (const transaction of networkTransactions) {
      try {
        const stellarTx = await server.transactions().transaction(transaction.transactionHash).call();
        if (stellarTx.successful && stellarTx.memo === documentHash) {
          return true;
        }
      } catch (error) {
        this.logger.warn(`Failed to verify transaction ${transaction.transactionHash}:`, error);
      }
    }
    
    return false;
  }
}
