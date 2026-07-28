import { Test, TestingModule } from '@nestjs/testing';
import { AccessLogsController } from './access-logs.controller';
import { AccessLogsService } from './access-logs.service';
import { FilterAccessLogsDto } from './dto/filter-access-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AccessLogsController', () => {
  let controller: AccessLogsController;
  let service: AccessLogsService;

  const mockAccessLogsService = {
    findAll: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessLogsController],
      providers: [
        {
          provide: AccessLogsService,
          useValue: mockAccessLogsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccessLogsController>(AccessLogsController);
    service = module.get<AccessLogsService>(AccessLogsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return paginated access logs for admin user', async () => {
    const filterDto: FilterAccessLogsDto = { page: 1, limit: 10 };
    const result = await controller.getAccessLogs(filterDto);

    expect(service.findAll).toHaveBeenCalledWith(filterDto);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
  });
});
