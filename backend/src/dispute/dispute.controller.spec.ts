import { Test, TestingModule } from '@nestjs/testing';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { DocumentsService } from '../documents/documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';

const mockDispute = {
  id: 'dispute-1',
  documentId: 'doc-1',
  description: 'Invalid signature',
  reason: null,
  filedBy: 'user-1',
  createdAt: new Date(),
};

const mockDocument = {
  id: 'doc-1',
  ownerId: 'user-1',
  title: 'Land Deed',
  status: 'pending',
};

const mockDisputeService = {
  fileDispute: jest.fn().mockImplementation((_dto, userId) =>
    Promise.resolve({ ...mockDispute, filedBy: userId }),
  ),
  findByUser: jest.fn().mockResolvedValue({ data: [mockDispute], total: 1 }),
  findOne: jest.fn().mockImplementation((id) =>
    Promise.resolve({ ...mockDispute, id }),
  ),
};

const mockDocumentsService = {
  findById: jest.fn().mockResolvedValue(mockDocument),
};

describe('DisputeController', () => {
  let controller: DisputeController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [
        { provide: DisputeService, useValue: mockDisputeService },
        { provide: DocumentsService, useValue: mockDocumentsService },
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

  describe('fileDispute()', () => {
    it('should allow owner to file dispute on own document', async () => {
      const result = await controller.fileDispute(
        { documentId: 'doc-1', description: 'test' } as any,
        { user: { id: 'user-1', role: 'user' } } as any,
      );
      expect(result.filedBy).toBe('user-1');
    });

    it('should allow admin to file dispute on any document', async () => {
      const result = await controller.fileDispute(
        { documentId: 'doc-1', description: 'test' } as any,
        { user: { id: 'admin-1', role: 'admin' } } as any,
      );
      expect(result.filedBy).toBe('admin-1');
    });

    it('should reject non-owner non-admin filing dispute', async () => {
      await expect(
        controller.fileDispute(
          { documentId: 'doc-1', description: 'test' } as any,
          { user: { id: 'user-2', role: 'user' } } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if document not found', async () => {
      mockDocumentsService.findById.mockResolvedValueOnce(null);
      await expect(
        controller.fileDispute(
          { documentId: 'nonexistent', description: 'test' } as any,
          { user: { id: 'user-1', role: 'user' } } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDispute()', () => {
    it('should allow owner to view own dispute', async () => {
      const result = await controller.getDispute('dispute-1', {
        user: { id: 'user-1', role: 'user' },
      } as any);
      expect(result.id).toBe('dispute-1');
    });

    it('should reject non-owner viewing dispute', async () => {
      await expect(
        controller.getDispute('dispute-1', {
          user: { id: 'user-2', role: 'user' },
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
