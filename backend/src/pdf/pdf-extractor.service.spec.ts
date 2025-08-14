import { Test, TestingModule } from '@nestjs/testing';
import { PdfExtractorService } from './pdf-extractor.service';
import * as path from 'path';

describe('PdfExtractorService', () => {
  let service: PdfExtractorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfExtractorService],
    }).compile();

    service = module.get<PdfExtractorService>(PdfExtractorService);
  });

  it('should extract text from native PDF', async () => {
    const samplePath = path.join(__dirname, '../../test-samples/native.pdf');
    const text = await service.extractText(samplePath);
    expect(text).toContain('Expected sample text');
  });

  it('should extract text from scanned PDF (OCR)', async () => {
    const samplePath = path.join(__dirname, '../../test-samples/scanned.pdf');
    const text = await service.extractText(samplePath);
    expect(text.length).toBeGreaterThan(0);
  });
});
