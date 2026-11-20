import { DocumentExportService } from './document-export.service';
import { DocumentsService } from './documents.service';
import { Document, DocumentStatus } from './entities/document.entity';

const doc = (over: Partial<Document> = {}): Document =>
  ({
    id: 'd1',
    ownerId: 'u1',
    title: 'Deed',
    status: DocumentStatus.VERIFIED,
    riskScore: 12,
    riskFlags: ['a'],
    fileSize: 10,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }) as Document;

describe('DocumentExportService', () => {
  const service = new DocumentExportService();

  it('builds an xlsx file (zip magic bytes)', async () => {
    const buffer = await service.toExcel([doc()]);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('builds a PDF file', async () => {
    const buffer = await service.toPdf([doc()], 'Report');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('DocumentsService.findFiltered ownership', () => {
  function setup() {
    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const repo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    return { qb, service: new DocumentsService(repo) };
  }

  it('restrictToOwnerId overrides a caller-supplied ownerId', async () => {
    const { qb, service } = setup();
    await service.findFiltered({ ownerId: 'someone-else' }, { restrictToOwnerId: 'me' });
    expect(qb.andWhere).toHaveBeenCalledWith('document.owner_id = :owner', {
      owner: 'me',
    });
  });

  it('applies no owner clause for an unrestricted admin query', async () => {
    const { qb, service } = setup();
    await service.findFiltered({ status: DocumentStatus.FLAGGED });
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'document.owner_id = :owner',
      expect.anything(),
    );
  });
});
