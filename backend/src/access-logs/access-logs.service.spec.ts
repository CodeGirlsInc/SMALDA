import { Test, TestingModule } from '@nestjs/testing';
import { AccessLogsService } from './access-logs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessLog } from './entities/access-log.entity';
import { Repository } from 'typeorm';
import { CreateAccessLogDto } from './dto/create-access-log.dto';
import { FilterAccessLogsDto } from './dto/filter-access-logs.dto';

describe('AccessLogsService', () => {
  let service: AccessLogsService;
  let repository: Repository<AccessLog>;

  const mockAccessLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessLogsService,
        {
          provide: getRepositoryToken(AccessLog),
          useValue: mockAccessLogRepository,
        },
      ],
    }).compile();

    service = module.get<AccessLogsService>(AccessLogsService);
    repository = module.get<Repository<AccessLog>>(
      getRepositoryToken(AccessLog),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save an access log', async () => {
      const createDto: CreateAccessLogDto = {
        userId: 'user-1',
        routePath: '/test',
        httpMethod: 'GET',
        ipAddress: '127.0.0.1',
      };
      const log = { id: 'log-1', ...createDto };

      mockAccessLogRepository.create.mockReturnValue(log);
      mockAccessLogRepository.save.mockResolvedValue(log);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalledWith(log);
      expect(result).toEqual(log);
    });
  });

  describe('findAll', () => {
    it('should return paginated access logs', async () => {
      const filterDto: FilterAccessLogsDto = { page: 1, limit: 10 };
      const logs = [{ id: 'log-1' }];
      const total = 1;

      mockAccessLogRepository.findAndCount.mockResolvedValue([logs, total]);

      const result = await service.findAll(filterDto);

      expect(repository.findAndCount).toHaveBeenCalled();
      expect(result.data).toEqual(logs);
      expect(result.total).toBe(total);
    });
  });
});
