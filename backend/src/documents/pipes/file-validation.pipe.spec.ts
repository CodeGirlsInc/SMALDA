import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import sharp = require('sharp');
import { FileValidationPipe } from './file-validation.pipe';

function createFile(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: null as any,
    destination: '',
    filename: originalname,
    path: '',
  };
}

async function createValidPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  return Buffer.from(await pdf.save());
}

async function createValidJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: 'white' },
  })
    .jpeg()
    .toBuffer();
}

async function createValidPng(): Promise<Buffer> {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
}


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

  it('should accept a valid PDF by content', async () => {
    const buffer = await createValidPdf();
    const file = createFile(buffer, 'application/pdf', 'deed.pdf');
    const result = await pipe.transform(file);
    expect(result.mimetype).toBe('application/pdf');
  });

  it('should accept a valid PNG by content', async () => {
    const buffer = await createValidPng();
    const file = createFile(buffer, 'image/png', 'survey.png');
    const result = await pipe.transform(file);
    expect(result.mimetype).toBe('image/png');
  });

  it('should reject an executable renamed to .pdf', async () => {
    const buffer = Buffer.from('MZ\x90\x00');
    const file = createFile(buffer, 'application/pdf', 'malware.pdf');
    await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
  });

  it('should reject a zip archive by content regardless of extension', async () => {
    const buffer = Buffer.from('PK\x03\x04');
    const file = createFile(buffer, 'application/pdf', 'archive.pdf');
    await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
  });

  it('should reject a file whose declared MIME type does not match content', async () => {
    const buffer = await createValidPdf();
    const file = createFile(buffer, 'image/png', 'spoof.png');
    await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
  });

  it('should reject blocked file extensions', async () => {
    const buffer = await createValidPdf();
    const file = createFile(buffer, 'application/pdf', 'script.sh');
    await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
  });

  it('should reject files that exceed the maximum size', async () => {
    const jpeg = await createValidJpeg();
    const buffer = Buffer.alloc(21 * 1024 * 1024, 0xff);
    jpeg.copy(buffer);
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;
    const file = createFile(buffer, 'image/jpeg', 'huge.jpg');
    await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
  });

  it('should strip metadata from a JPEG', async () => {
    const buffer = await createValidJpeg();
    const file = createFile(buffer, 'image/jpeg', 'photo.jpg');
    const result = await pipe.transform(file);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.mimetype).toBe('image/jpeg');
  });
});
