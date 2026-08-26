import { Test, TestingModule } from '@nestjs/testing';
import { AccessLogsController } from './access-logs.controller';
import { AccessLogsService } from './access-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AccessLogsController', () => {
  let controller: AccessLogsController;

  const mockService = {
    findAll: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessLogsController],
      providers: [{ provide: AccessLogsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccessLogsController>(AccessLogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return filtered access logs', async () => {
    const result = await controller.getAccessLogs({
      userId: 'user-1',
      httpMethod: 'GET',
      page: 1,
      limit: 25,
    });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockService.findAll).toHaveBeenCalledWith({
      userId: 'user-1',
      httpMethod: 'GET',
      page: 1,
      limit: 25,
    });
  });

  it('should pass empty filters', async () => {
    await controller.getAccessLogs({});
    expect(mockService.findAll).toHaveBeenCalledWith({});
  });
});
