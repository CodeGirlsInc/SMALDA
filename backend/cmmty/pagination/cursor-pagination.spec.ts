import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationModule } from './pagination.module';
import { CursorPaginationHelper } from './cursor-pagination';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';

describe('CursorPaginationHelper', () => {
  let helper: CursorPaginationHelper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PaginationModule],
      providers: [CursorPaginationHelper],
    }).compile();

    helper = module.get<CursorPaginationHelper>(CursorPaginationHelper);
  });

  it('should be defined', () => {
    expect(helper).toBeDefined();
  });

  describe('encodeCursor and decodeCursor', () => {
    it('should encode and decode cursor correctly', () => {
      const id = 'test-id-123';
      const createdAt = new Date('2024-01-15T10:30:00Z');
      
      const encoded = CursorPaginationHelper.encodeCursor(id, createdAt);
      const decoded = CursorPaginationHelper.decodeCursor(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe(id);
      expect(new Date(decoded!.createdAt).toISOString()).toBe(createdAt.toISOString());
    });

    it('should return null for invalid cursor', () => {
      const decoded = CursorPaginationHelper.decodeCursor('invalid-cursor');
      expect(decoded).toBeNull();
    });
  });

  describe('processResults', () => {
    it('should return hasMore false when results are less than limit', () => {
      const results = [
        { id: '1', title: 'Doc 1', createdAt: new Date() },
        { id: '2', title: 'Doc 2', createdAt: new Date() },
      ];

      const paginated = CursorPaginationHelper.processResults(results, 10);

      expect(paginated.hasMore).toBe(false);
      expect(paginated.data).toHaveLength(2);
      expect(paginated.nextCursor).toBeNull();
    });

    it('should return hasMore true when results exceed limit', () => {
      const results = [
        { id: '1', title: 'Doc 1', createdAt: new Date() },
        { id: '2', title: 'Doc 2', createdAt: new Date() },
        { id: '3', title: 'Doc 3', createdAt: new Date() },
      ];

      const paginated = CursorPaginationHelper.processResults(results, 2);

      expect(paginated.hasMore).toBe(true);
      expect(paginated.data).toHaveLength(2);
      expect(paginated.nextCursor).not.toBeNull();
    });

    it('should handle empty results', () => {
      const results: any[] = [];

      const paginated = CursorPaginationHelper.processResults(results, 10);

      expect(paginated.hasMore).toBe(false);
      expect(paginated.data).toHaveLength(0);
      expect(paginated.nextCursor).toBeNull();
    });
  });
});