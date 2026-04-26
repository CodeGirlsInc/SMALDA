import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditAction, ResourceType } from './entities/audit-log.entity';
import { AuditLogPaginationQueryDto } from './dto/audit-log-pagination-query.dto';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: Repository<AuditLog>;

  const mockAuditLog: AuditLog = {
    id: 'audit-log-id-123',
    userId: 'user-id-123',
    action: AuditAction.LOGIN,
    resourceType: ResourceType.USER,
    resourceId: 'user-id-123',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save an audit log', async () => {
      mockRepository.create.mockReturnValue(mockAuditLog);
      mockRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.create(
        'user-id-123',
        AuditAction.LOGIN,
        ResourceType.USER,
        'user-id-123',
        '127.0.0.1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-id-123',
        action: AuditAction.LOGIN,
        resourceType: ResourceType.USER,
        resourceId: 'user-id-123',
        ipAddress: '127.0.0.1',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockAuditLog);
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('findByUserId', () => {
    it('should return paginated audit logs for a user', async () => {
      const dto: AuditLogPaginationQueryDto = { limit: 10, offset: 0 };
      const mockData = [mockAuditLog];
      const mockTotal = 1;

      mockRepository.findAndCount.mockResolvedValue([mockData, mockTotal]);

      const result = await service.findByUserId('user-id-123', dto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-id-123' },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({ data: mockData, total: mockTotal });
    });
  });

  describe('findAll', () => {
    it('should return all paginated audit logs', async () => {
      const dto: AuditLogPaginationQueryDto = { limit: 10, offset: 0 };
      const mockData = [mockAuditLog];
      const mockTotal = 1;

      mockRepository.findAndCount.mockResolvedValue([mockData, mockTotal]);

      const result = await service.findAll(dto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({ data: mockData, total: mockTotal });
    });
  });
});