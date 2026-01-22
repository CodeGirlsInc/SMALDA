import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { StellarTransaction, TransactionStatus, NetworkType } from './entities/stellar-transaction.entity';
import { StellarAccount } from './entities/stellar-account.entity';
import { StellarConfig } from './config/stellar.config';
import * as StellarSDK from 'stellar-sdk';

describe('StellarService', () => {
  let service: StellarService;
  let transactionRepository: jest.Mocked<Repository<StellarTransaction>>;
  let accountRepository: jest.Mocked<Repository<StellarAccount>>;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig: StellarConfig = {
    testnet: {
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      friendbotUrl: 'https://friendbot.stellar.org',
    },
    mainnet: {
      horizonUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    },
    defaultNetwork: NetworkType.TESTNET,
    fee: {
      base: 100,
      max: 1000,
    },
    timeouts: {
      transaction: 30000,
      polling: 60000,
      confirmation: 120000,
    },
    retry: {
      attempts: 3,
      delay: 1000,
    },
  };

  beforeEach(async () => {
    const mockTransactionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    const mockAccountRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    const mockConfigService = {
      get: jest.fn().mockReturnValue(mockConfig),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'StellarTransactionRepository',
          useValue: mockTransactionRepository,
        },
        {
          provide: 'StellarAccountRepository',
          useValue: mockAccountRepository,
        },
      ],
    })
      .overrideProvider('StellarTransactionRepository')
      .useValue(mockTransactionRepository)
      .overrideProvider('StellarAccountRepository')
      .useValue(mockAccountRepository)
      .compile();

    service = module.get<StellarService>(StellarService);
    transactionRepository = module.get('StellarTransactionRepository');
    accountRepository = module.get('StellarAccountRepository');
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAccount', () => {
    it('should create a new Stellar account', async () => {
      const mockKeypair = {
        publicKey: jest.fn().mockReturnValue('G' + 'A'.repeat(55)),
        secret: jest.fn().mockReturnValue('S' + 'A'.repeat(55)),
      };

      jest.spyOn(StellarSDK, 'Keypair').mockImplementation(() => mockKeypair as any);

      const mockAccount = {
        id: 'test-id',
        publicKey: 'G' + 'A'.repeat(55),
        encryptedSecretKey: 'S' + 'A'.repeat(55),
        network: NetworkType.TESTNET,
        isFunded: false,
      };

      accountRepository.create.mockReturnValue(mockAccount);
      accountRepository.save.mockResolvedValue(mockAccount);

      const result = await service.createAccount(NetworkType.TESTNET);

      expect(result.publicKey).toBe('G' + 'A'.repeat(55));
      expect(result.secretKey).toBe('S' + 'A'.repeat(55));
      expect(accountRepository.create).toHaveBeenCalled();
      expect(accountRepository.save).toHaveBeenCalled();
    });
  });

  describe('estimateTransactionFee', () => {
    it('should estimate transaction fee correctly', async () => {
      const sourcePublicKey = 'G' + 'A'.repeat(55);
      const documentHash = 'a'.repeat(64);

      const mockServer = {
        loadAccount: jest.fn().mockResolvedValue({
          accountId: sourcePublicKey,
          sequence: '1',
        }),
      };

      jest.spyOn(StellarSDK, 'Horizon').mockImplementation(() => ({
        Server: jest.fn().mockImplementation(() => mockServer),
      } as any));

      const result = await service.estimateTransactionFee(sourcePublicKey, documentHash);

      expect(result.fee).toBe(mockConfig.fee.base);
      expect(result.cost).toBe(mockConfig.fee.base.toString());
    });
  });

  describe('verifyDocumentOnStellar', () => {
    it('should verify document exists on Stellar', async () => {
      const documentHash = 'a'.repeat(64);
      const mockTransaction = {
        id: 'test-id',
        transactionHash: 't'.repeat(64),
        documentHash,
        network: NetworkType.TESTNET,
        status: TransactionStatus.SUCCESS,
      };

      transactionRepository.find.mockResolvedValue([mockTransaction]);

      const mockServer = {
        transactions: jest.fn().mockReturnValue({
          transaction: jest.fn().mockReturnValue({
            call: jest.fn().mockResolvedValue({
              successful: true,
              memo: documentHash,
            }),
          }),
        }),
      };

      jest.spyOn(StellarSDK, 'Horizon').mockImplementation(() => ({
        Server: jest.fn().mockImplementation(() => mockServer),
      } as any));

      const result = await service.verifyDocumentOnStellar(documentHash, NetworkType.TESTNET);

      expect(result).toBe(true);
    });

    it('should return false if document not found', async () => {
      const documentHash = 'a'.repeat(64);

      transactionRepository.find.mockResolvedValue([]);

      const result = await service.verifyDocumentOnStellar(documentHash, NetworkType.TESTNET);

      expect(result).toBe(false);
    });
  });
});
