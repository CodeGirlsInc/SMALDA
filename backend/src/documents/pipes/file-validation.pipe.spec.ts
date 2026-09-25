import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
const sharp = require('sharp') as (...args: any[]) => any;
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

function createSvg(markup: string): Buffer {
  return Buffer.from(markup, 'utf8');
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

  it('should accept static SVG content and store a bounded PNG', async () => {
    const buffer = createSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
        <title>Parcel A &amp; B</title>
        <defs>
          <linearGradient id="paint">
            <stop offset="0" stop-color="#fff" />
          </linearGradient>
        </defs>
        <path id="shape" d="M0 0 L120 40" fill="url(#paint)" stroke="#123456" stroke-width="2" />
        <text aria-label="https://maps.example/Parcel"><textPath href="#shape">Parcel A</textPath></text>
      </svg>
    `);
    const file = createFile(buffer, 'image/svg+xml', 'survey.svg');

    const result = await pipe.transform(file);

    expect(result.mimetype).toBe('image/png');
    expect(result.buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(result.size).toBe(result.buffer.length);
  });

  it.each<[string, RegExp]>([
    ['<script>alert(1)</script>', /active or resource-bearing content/i],
    ['<script />', /active or resource-bearing content/i],
    ['<animate attributeName="href" values="javascript:alert(1)" />', /active or resource-bearing content/i],
    ['<style>rect { fill: red }</style>', /active or resource-bearing content/i],
    ['<foreignObject><div>html</div></foreignObject>', /active or resource-bearing content/i],
    ['<image href="data:image/png;base64,AA==" />', /active or resource-bearing content/i],
    ['<feImage href="https://attacker.example/pixel.png" />', /active or resource-bearing content/i],
  ])('should reject active SVG element %s', async (element, expectedError) => {
    const buffer = createSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">${element}</svg>`,
    );
    const file = createFile(buffer, 'image/svg+xml', 'active.svg');

    await expect(pipe.transform(file)).rejects.toThrow(expectedError);
  });

  it.each([
    '<rect width="1" height="1" onload="alert(1)" />',
    '<rect width="1" height="1" style="fill:url(https://attacker.example/paint)" />',
  ])('should reject active SVG attribute in %s', async (element) => {
    const buffer = createSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">${element}</svg>`,
    );
    const file = createFile(buffer, 'image/svg+xml', 'active-attribute.svg');

    await expect(pipe.transform(file)).rejects.toThrow(
      /active or unsafe attributes/i,
    );
  });

  it('should preserve inert descriptive attributes that contain URL-like text', async () => {
    const buffer = createSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text aria-label="url(https://maps.example/reference)" data-reference="url(https://maps.example/data)">Parcel</text></svg>',
    );

    const result = await pipe.transform(
      createFile(buffer, 'image/svg+xml', 'descriptive.svg'),
    );

    expect(result.mimetype).toBe('image/png');
  });

  it.each([
    '<rect fill="url(/**/https://attacker.example/paint)" />',
    '<rect fill="u\\72l(https://attacker.example/paint)" />',
  ])('should reject obfuscated external CSS URLs in %s', async (element) => {
    const buffer = createSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">${element}</svg>`,
    );

    await expect(
      pipe.transform(
        createFile(buffer, 'image/svg+xml', 'external-css.svg'),
      ),
    ).rejects.toThrow(/external or embedded resource/i);
  });

  it('should reject unsupported elements and oversized tags before rasterization', async () => {
    const unsupported = createSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><unknown /></svg>',
    );
    const oversized = createSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><rect data-note="${'a'.repeat(64 * 1024)}" /></svg>`,
    );

    await expect(
      pipe.transform(
        createFile(unsupported, 'image/svg+xml', 'unknown.svg'),
      ),
    ).rejects.toThrow(/not supported/i);
    await expect(
      pipe.transform(
        createFile(oversized, 'image/svg+xml', 'oversized.svg'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject external SVG references', async () => {
    const buffer = createSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<text><textPath href="https://attacker.example/path">Parcel</textPath></text>' +
        '</svg>',
    );
    const file = createFile(buffer, 'image/svg+xml', 'external.svg');

    await expect(pipe.transform(file)).rejects.toThrow(
      /resource-bearing|external|embedded resource/i,
    );
  });

  it('should reject data URLs in SVG attributes', async () => {
    const buffer = createSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<text><textPath href="data:image/png;base64,AA==">Parcel</textPath></text>' +
        '</svg>',
    );
    const file = createFile(buffer, 'image/svg+xml', 'data.svg');

    await expect(pipe.transform(file)).rejects.toThrow(
      /resource-bearing|external|embedded resource/i,
    );
  });

  it('should reject SVG entities and external resources', async () => {
    const buffer = createSvg(`
      <!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>
    `);
    const file = createFile(buffer, 'image/svg+xml', 'entity.svg');

    await expect(pipe.transform(file)).rejects.toThrow(/unsafe XML content/i);
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
