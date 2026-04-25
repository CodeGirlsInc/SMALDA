import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpFilterService } from './ip-filter.service';
import { IpRule, IpRuleType } from './entities/ip-rule.entity';
import { CreateIpRuleDto } from './dto/create-ip-rule.dto';

describe('IpFilterService', () => {
  let service: IpFilterService;
  let ipRuleRepository: Repository<IpRule>;

  const mockIpRuleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpFilterService,
        {
          provide: getRepositoryToken(IpRule),
          useValue: mockIpRuleRepository,
        },
      ],
    }).compile();

    service = module.get<IpFilterService>(IpFilterService);
    ipRuleRepository = module.get<Repository<IpRule>>(getRepositoryToken(IpRule));

    jest.clearAllMocks();
  });

  describe('createIpRule', () => {
    it('should create a new IP rule', async () => {
      const dto: CreateIpRuleDto = {
        cidr: '192.168.1.0/24',
        type: IpRuleType.BLOCK,
        reason: 'Suspicious activity',
      };
      const mockRule = { id: 'rule-1', ...dto, createdAt: new Date() } as IpRule;

      mockIpRuleRepository.create.mockReturnValue(mockRule);
      mockIpRuleRepository.save.mockResolvedValue(mockRule);

      const result = await service.createIpRule(dto);

      expect(result).toEqual(mockRule);
      expect(mockIpRuleRepository.create).toHaveBeenCalledWith(dto);
      expect(mockIpRuleRepository.save).toHaveBeenCalledWith(mockRule);
    });
  });

  describe('deleteIpRule', () => {
    it('should delete an IP rule', async () => {
      mockIpRuleRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteIpRule('rule-1');

      expect(mockIpRuleRepository.delete).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('getAllIpRules', () => {
    it('should return all IP rules', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '192.168.1.0/24', type: IpRuleType.BLOCK },
        { id: 'rule-2', cidr: '10.0.0.0/8', type: IpRuleType.ALLOW },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.getAllIpRules();

      expect(result).toEqual(mockRules);
    });
  });

  describe('isIpAllowed - CIDR matching', () => {
    it('should allow IP when no rules exist', async () => {
      mockIpRuleRepository.find.mockResolvedValue([]);

      const result = await service.isIpAllowed('192.168.1.100');

      expect(result).toBe(true);
    });

    it('should block IP matching a BLOCK rule', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '192.168.1.0/24', type: IpRuleType.BLOCK },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('192.168.1.100');

      expect(result).toBe(false);
    });

    it('should allow IP not matching any BLOCK rule', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '192.168.1.0/24', type: IpRuleType.BLOCK },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('10.0.0.1');

      expect(result).toBe(true);
    });

    it('should allow IP matching an ALLOW rule', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '10.0.0.0/8', type: IpRuleType.ALLOW },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('10.0.0.50');

      expect(result).toBe(true);
    });

    it('should block IP not matching any ALLOW rule', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '10.0.0.0/8', type: IpRuleType.ALLOW },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('192.168.1.100');

      expect(result).toBe(false);
    });

    it('should block IP matching exact IP in BLOCK rule', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '192.168.1.100', type: IpRuleType.BLOCK },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('192.168.1.100');

      expect(result).toBe(false);
    });

    it('should handle /32 CIDR (single IP)', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '10.0.0.1/32', type: IpRuleType.BLOCK },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('10.0.0.1');

      expect(result).toBe(false);
    });

    it('should handle /0 CIDR (all IPs)', async () => {
      const mockRules = [
        { id: 'rule-1', cidr: '0.0.0.0/0', type: IpRuleType.BLOCK },
      ] as IpRule[];

      mockIpRuleRepository.find.mockResolvedValue(mockRules);

      const result = await service.isIpAllowed('255.255.255.255');

      expect(result).toBe(false);
    });
  });
});
