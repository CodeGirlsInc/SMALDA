import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    pipe = new FileValidationPipe();
  });

  const createMockFile = (overrides: Partial<Express.Multer.File> = {}) =>
    ({
      size: 1024,
      mimetype: 'application/pdf',
      originalname: 'test.pdf',
      ...overrides,
    }) as Express.Multer.File;

  it('should pass a valid file through', () => {
    const file = createMockFile();
    expect(pipe.transform(file)).toBe(file);
  });

  it('should throw if file is missing', () => {
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });

  it('should throw if file exceeds max size', () => {
    const file = createMockFile({ size: 20 * 1024 * 1024 });
    expect(() => pipe.transform(file)).toThrow(/File size exceeds/);
  });

  it('should throw for disallowed mime types', () => {
    const file = createMockFile({ mimetype: 'text/plain' });
    expect(() => pipe.transform(file)).toThrow(/Invalid file type/);
  });
});
