import { Test, TestingModule } from '@nestjs/testing';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { User } from '../users/entities/user.entity';

describe('DisputeController', () => {
  let controller: DisputeController;
  let service: DisputeService;

  const mockDisputeService = {
    fileDispute: jest.fn(),
    findByUser: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [
        {
          provide: DisputeService,
          useValue: mockDisputeService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DisputeController>(DisputeController);
    service = module.get<DisputeService>(DisputeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('fileDispute', () => {
    it('should call the service to file a dispute', async () => {
      const dto: CreateDisputeDto = {
        documentId: 'doc-1',
        description: 'Test dispute',
      };
      const user = { id: 'user-1' } as User;
      const req = { user };

      await controller.fileDispute(dto, req as any);

      expect(service.fileDispute).toHaveBeenCalledWith(dto, user.id);
    });
  });

  describe('getMyDisputes', () => {
    it('should call the service to find disputes by user', async () => {
      const user = { id: 'user-1' } as User;
      const req = { user };

      await controller.getMyDisputes(req as any, '10', '0');

      expect(service.findByUser).toHaveBeenCalledWith(user.id, 10, 0);
    });
  });

  describe('getDispute', () => {
    it('should call the service to find a single dispute', async () => {
      const user = { id: 'user-1' } as User;
      const req = { user };
      const disputeId = 'dispute-1';

      await controller.getDispute(disputeId, req as any);

      expect(service.findOne).toHaveBeenCalledWith(disputeId, user.id);
    });
  });
});
