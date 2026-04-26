import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { WatermarkService } from './watermark.service';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import * as fs from 'fs';

jest.mock('fs');

describe('WatermarkService', () => {
  let service: WatermarkService;

  const mockDocument = {
    id: 'doc-1',
    ownerId: 'user-1',
    title: 'Test Document.pdf',
    filePath: '/path/to/document.pdf',
    mimeType: 'application/pdf',
  } as Document;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'John Doe',
  } as User;

  const mockDocumentRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatermarkService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<WatermarkService>(WatermarkService);

    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReset();
    (fs.readFileSync as jest.Mock).mockReset();
  });

  describe('generateWatermarkText', () => {
    it('should generate watermark text with user name, timestamp, and document ID', () => {
      // Access private method via any cast for testing
      const watermarkText = (service as any).generateWatermarkText('John Doe', 'doc-123');

      expect(watermarkText).toContain('John Doe');
      expect(watermarkText).toContain('doc-123');
      // Should contain ISO timestamp
      expect(watermarkText).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should include full timestamp in ISO format', () => {
      const watermarkText = (service as any).generateWatermarkText('Jane Smith', 'doc-456');

      // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(watermarkText).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should separate components with pipe character', () => {
      const watermarkText = (service as any).generateWatermarkText('Test User', 'doc-789');

      const parts = watermarkText.split(' | ');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('Test User');
      expect(parts[2]).toBe('doc-789');
    });
  });

  describe('downloadWithWatermark', () => {
    it('should throw NotFoundException when document does not exist', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.downloadWithWatermark('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.downloadWithWatermark('doc-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when file does not exist on disk', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.downloadWithWatermark('doc-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
