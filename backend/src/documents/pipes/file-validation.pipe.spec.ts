import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as sharpLib from 'sharp';
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
  return (sharpLib as any)({
    create: { width: 10, height: 10, channels: 3, background: 'white' },
  })
    .jpeg()
    .toBuffer();
}

async function createValidPng(): Promise<Buffer> {
  return (sharpLib as any)({
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

  it('should pass a valid PDF file through', async () => {
    const buffer = await createValidPdf();
    const file = createFile(buffer, 'application/pdf', 'test.pdf');
    const result = await pipe.transform(file);
    expect(result.mimetype).toBe('application/pdf');
  });

  it('should throw if file is missing', async () => {
    await expect(pipe.transform(null as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw if file exceeds max size', async () => {
    const buffer = Buffer.alloc(21 * 1024 * 1024, 0xff);
    buffer[0] = 0x25;
    buffer[1] = 0x50;
    buffer[2] = 0x44;
    buffer[3] = 0x46;
    const file = createFile(buffer, 'application/pdf', 'huge.pdf');
    await expect(pipe.transform(file)).rejects.toThrow(
      /File exceeds maximum size/,
    );
  });

  it('should accept a valid PNG by content', async () => {
    const buffer = await createValidPng();
    const file = createFile(buffer, 'image/png', 'survey.png');
    const result = await pipe.transform(file);
    expect(result.mimetype).toBe('image/png');
  });

  it('should accept a valid JPEG by content', async () => {
    const buffer = await createValidJpeg();
    const file = createFile(buffer, 'image/jpeg', 'photo.jpg');
    const result = await pipe.transform(file);
    expect(result.mimetype).toBe('image/jpeg');
  });

  it('should reject an executable renamed to .pdf', async () => {
    const buffer = Buffer.from('MZ\x90\x00');
    const file = createFile(buffer, 'application/pdf', 'malware.pdf');
    await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
  });

  it('should reject a zip archive by content regardless of extension', async () => {
    const buffer = Buffer.from('PK\x03\x04test');
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
});
