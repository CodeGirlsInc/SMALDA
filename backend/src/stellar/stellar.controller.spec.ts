import { Test, TestingModule } from '@nestjs/testing';
import { StellarController } from './stellar.controller';
import { StellarService } from './stellar.service';
import { StellarTransaction, TransactionStatus, NetworkType } from './entities/stellar-transaction.entity';

describe('StellarController', () => {
  let controller: StellarController;
  let service: jest.Mocked<StellarService>;

  const mockTransaction: StellarTransaction = {
    id: 'test-id',
    transactionHash: 't'.repeat(64),
    documentHash: 'a'.repeat(64),
    memo: 'a'.repeat(64),
    status: TransactionStatus.SUCCESS,
    network: NetworkType.TESTNET,
    fee: '100',
    sourceAccount: 'G' + 'A'.repeat(55),
    destinationAccount: 'G' + 'A'.repeat(55),
    transactionData: '{}',
    errorData: null,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    confirmedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockStellarService = {
      createAccount: jest.fn(),
      fundAccount: jest.fn(),
      getAccountBalance: jest.fn(),
      estimateTransactionFee: jest.fn(),
      anchorDocumentHash: jest.fn(),
      batchAnchorDocuments: jest.fn(),
      pollTransactionStatus: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionsByDocumentHash: jest.fn(),
      verifyDocumentOnStellar: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StellarController],
      providers: [
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
      ],
    }).compile();

    controller = module.get<StellarController>(StellarController);
    service = module.get(StellarService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAccount', () => {
    it('should create a new account', async () => {
      const createAccountDto = {
        network: NetworkType.TESTNET,
      };

      const expectedResult = {
        publicKey: 'G' + 'A'.repeat(55),
        secretKey: 'S' + 'A'.repeat(55),
      };

      service.createAccount.mockResolvedValue(expectedResult);

      const result = await controller.createAccount(createAccountDto);

      expect(result).toEqual(expectedResult);
      expect(service.createAccount).toHaveBeenCalledWith(NetworkType.TESTNET);
    });
  });

  describe('fundAccount', () => {
    it('should fund an account', async () => {
      const fundAccountDto = {
        publicKey: 'G' + 'A'.repeat(55),
        network: NetworkType.TESTNET,
      };

      service.fundAccount.mockResolvedValue(undefined);

      const result = await controller.fundAccount(fundAccountDto);

      expect(result).toEqual({ message: 'Account funded successfully' });
      expect(service.fundAccount).toHaveBeenCalledWith(fundAccountDto.publicKey, NetworkType.TESTNET);
    });
  });

  describe('getBalance', () => {
    it('should get account balance', async () => {
      const publicKey = 'G' + 'A'.repeat(55);
      const network = 'testnet';
      const expectedBalance = '1000.0000000';

      service.getAccountBalance.mockResolvedValue(expectedBalance);

      const result = await controller.getBalance(publicKey, network);

      expect(result).toEqual({ balance: expectedBalance });
      expect(service.getAccountBalance).toHaveBeenCalledWith(publicKey, NetworkType.TESTNET);
    });
  });

  describe('estimateFee', () => {
    it('should estimate transaction fee', async () => {
      const estimateFeeDto = {
        sourcePublicKey: 'G' + 'A'.repeat(55),
        documentHash: 'a'.repeat(64),
        network: NetworkType.TESTNET,
      };

      const expectedResult = {
        fee: 100,
        cost: '100',
      };

      service.estimateTransactionFee.mockResolvedValue(expectedResult);

      const result = await controller.estimateFee(estimateFeeDto);

      expect(result).toEqual(expectedResult);
      expect(service.estimateTransactionFee).toHaveBeenCalledWith(
        estimateFeeDto.sourcePublicKey,
        estimateFeeDto.documentHash,
        estimateFeeDto.network,
      );
    });
  });

  describe('anchorDocument', () => {
    it('should anchor a document hash', async () => {
      const anchorDocumentDto = {
        sourcePublicKey: 'G' + 'A'.repeat(55),
        sourceSecretKey: 'S' + 'A'.repeat(55),
        documentHash: 'a'.repeat(64),
        network: NetworkType.TESTNET,
      };

      service.anchorDocumentHash.mockResolvedValue(mockTransaction);

      const result = await controller.anchorDocument(anchorDocumentDto);

      expect(result).toEqual(mockTransaction);
      expect(service.anchorDocumentHash).toHaveBeenCalledWith(
        anchorDocumentDto.sourcePublicKey,
        anchorDocumentDto.sourceSecretKey,
        anchorDocumentDto.documentHash,
        anchorDocumentDto.network,
      );
    });
  });

  describe('verifyDocument', () => {
    it('should verify document on Stellar', async () => {
      const verifyDocumentDto = {
        documentHash: 'a'.repeat(64),
        network: NetworkType.TESTNET,
      };

      service.verifyDocumentOnStellar.mockResolvedValue(true);

      const result = await controller.verifyDocument(verifyDocumentDto);

      expect(result).toEqual({ verified: true });
      expect(service.verifyDocumentOnStellar).toHaveBeenCalledWith(
        verifyDocumentDto.documentHash,
        verifyDocumentDto.network,
      );
    });
  });
});
