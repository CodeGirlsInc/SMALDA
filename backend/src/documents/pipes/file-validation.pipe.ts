import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { PDFDocument, PDFName } from 'pdf-lib';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_FILE_SIZE_BYTES,
} from '../../common/api-contracts';
const sharp = require('sharp') as (...args: any[]) => any;

const ALLOWED_MIME_TYPES = DOCUMENT_ALLOWED_MIME_TYPES;
const MAX_FILE_SIZE_BYTES = DOCUMENT_MAX_FILE_SIZE_BYTES;
const MAX_SVG_RASTER_DIMENSION = 4096;
const MAX_SVG_ELEMENTS = 50_000;
const MAX_SVG_DEPTH = 128;
const MAX_SVG_TAG_LENGTH = 64 * 1024;
const MAX_SVG_ATTRIBUTES_PER_ELEMENT = 256;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

const DISALLOWED_SVG_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'style',
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  'discard',
  'handler',
  'listener',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'link',
  'meta',
  'a',
  'image',
  'feimage',
  'font-face-uri',
  'color-profile',
  'mpath',
  'use',
]);

const ALLOWED_SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textpath',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'pattern',
  'marker',
  'symbol',
  'view',
  'mask',
  'filter',
  'fegaussianblur',
  'feoffset',
  'feblend',
  'fecolormatrix',
  'fecomponenttransfer',
  'fecomposite',
  'fediffuselighting',
  'feconvolvematrix',
  'fedisplacementmap',
  'fedropshadow',
  'feflood',
  'fefunca',
  'fefuncb',
  'fefuncg',
  'fefuncr',
  'femerge',
  'femergenode',
  'femorphology',
  'fepointlight',
  'fespecularlighting',
  'fespotlight',
  'fetile',
  'feturbulence',
  'switch',
  'font',
  'font-face',
  'font-face-format',
  'font-face-name',
  'glyph',
  'missing-glyph',
  'hkern',
  'vkern',
  'tref',
  'cursor',
]);

const URL_ATTRIBUTES = new Set([
  'href',
  'xlink:href',
  'src',
  'srcset',
  'action',
  'formaction',
  'poster',
  'background',
  'codebase',
  'cite',
  'icon',
  'manifest',
  'profile',
  'usemap',
  'ping',
  'longdesc',
]);

const CSS_URL_ATTRIBUTES = new Set([
  'background-image',
  'clip-path',
  'color-profile',
  'cursor',
  'fill',
  'filter',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);

interface DetectedType {
  mime: string;
  ext: string;
}

const BLOCKED_MIME_PREFIXES = [
  'application/zip',
  'application/x-zip',
  'application/x-rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip',
  'application/x-bzip2',
  'application/x-msdownload',
  'application/x-exe',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-bat',
  'application/javascript',
  'text/javascript',
  'application/x-shellscript',
];

const BLOCKED_EXTENSIONS = [
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.sh',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
];

@Injectable()
export class FileValidationPipe implements PipeTransform<
  Express.Multer.File,
  Promise<Express.Multer.File>
> {
  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.validateSize(file);
    this.rejectByExtension(file.originalname);

    const detectedType = this.detectFileType(file.buffer);

    if (!detectedType) {
      throw new BadRequestException(
        'Unable to determine file type from content',
      );
    }

    this.rejectBlockedMimeType(detectedType.mime);

    if (!ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      throw new BadRequestException(
        `File type ${detectedType.mime} is not allowed`,
      );
    }

    if (detectedType.mime !== file.mimetype) {
      throw new BadRequestException(
        `Declared MIME type ${file.mimetype} does not match actual file type ${detectedType.mime}`,
      );
    }

    if (detectedType.mime === 'image/svg+xml') {
      await this.sanitizeSvg(file);
      return file;
    }

    if (detectedType.mime === 'application/pdf') {
      await this.validatePdf(file.buffer);
    }

    if (
      detectedType.mime === 'image/png' ||
      detectedType.mime === 'image/jpeg'
    ) {
      file.buffer = await this.stripImageMetadata(file.buffer);
    }

    return file;
  }

  private detectFileType(buffer: Buffer): DetectedType | undefined {
    if (buffer.length < 4) return undefined;

    if (buffer.slice(0, 4).toString('ascii') === '%PDF') {
      return { mime: 'application/pdf', ext: 'pdf' };
    }

    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mime: 'image/png', ext: 'png' };
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }

    const svg = this.decodeSvg(buffer);
    if (svg && this.looksLikeSvg(svg)) {
      return { mime: 'image/svg+xml', ext: 'svg' };
    }

    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      return { mime: 'application/zip', ext: 'zip' };
    }

    if (buffer.slice(0, 4).toString('ascii') === 'Rar!') {
      return { mime: 'application/x-rar', ext: 'rar' };
    }

    if (
      buffer[0] === 0x37 &&
      buffer[1] === 0x7a &&
      buffer[2] === 0xbc &&
      buffer[3] === 0xaf
    ) {
      return { mime: 'application/x-7z-compressed', ext: '7z' };
    }

    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return { mime: 'application/gzip', ext: 'gz' };
    }

    if (buffer[0] === 0x42 && buffer[1] === 0x5a && buffer[2] === 0x68) {
      return { mime: 'application/x-bzip2', ext: 'bz2' };
    }

    if (buffer.slice(0, 2).toString('ascii') === 'MZ') {
      return { mime: 'application/x-msdownload', ext: 'exe' };
    }

    if (buffer[0] === 0x7f && buffer.slice(1, 4).toString('ascii') === 'ELF') {
      return { mime: 'application/x-elf', ext: 'elf' };
    }

    return undefined;
  }

  private decodeSvg(buffer: Buffer): string | null {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return null;
    }
  }

  private stripXmlDeclaration(source: string): string {
    return source.replace(
      /^\uFEFF?\s*<\?xml\s+version\s*=\s*(['"])1\.0\1(?:\s+encoding\s*=\s*(['"])UTF-8\2)?(?:\s+standalone\s*=\s*(['"])(?:yes|no)\3)?\s*\?>\s*/i,
      '',
    );
  }

  private hasSvgRoot(source: string): boolean {
    return /^<svg(?:\s|>)/i.test(this.stripXmlDeclaration(source));
  }

  private looksLikeSvg(source: string): boolean {
    return this.hasSvgRoot(source) || /<svg(?:\s|>)/i.test(source);
  }

  private assertSafeSvg(source: string): void {
    const body = this.stripXmlDeclaration(source);
    if (
      /<!--|<!\[CDATA\[|<\?|<!DOCTYPE|<!ENTITY/i.test(body) ||
      /&(?!(?:amp|lt|gt|quot|apos);)/.test(body)
    ) {
      throw new BadRequestException('SVG contains unsafe XML content');
    }
    if (!/^<svg(?:\s|>)/i.test(body)) {
      throw new BadRequestException('Invalid SVG document');
    }

    const stack: string[] = [];
    let elementCount = 0;
    let rootClosed = false;
    let index = 0;

    while (index < body.length) {
      if (body[index] !== '<') {
        index += 1;
        continue;
      }

      if (rootClosed) {
        if (/\S/.test(body.slice(index))) {
          throw new BadRequestException('Invalid SVG document');
        }
        break;
      }

      const tagEnd = this.findSvgTagEnd(body, index + 1);
      if (tagEnd === -1) {
        throw new BadRequestException('Invalid SVG document');
      }

      const rawTag = body.slice(index + 1, tagEnd);
      if (!rawTag || rawTag.startsWith('!') || rawTag.startsWith('?')) {
        throw new BadRequestException('SVG contains unsafe XML content');
      }

      if (rawTag.startsWith('/')) {
        const closingMatch = /^\/\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*$/.exec(
          rawTag,
        );
        if (!closingMatch) {
          throw new BadRequestException('Invalid SVG document');
        }

        const name = closingMatch[1].toLowerCase();
        if (stack.pop() !== name) {
          throw new BadRequestException('Invalid SVG document');
        }
        if (stack.length === 0) rootClosed = true;
      } else {
        const openingMatch = /^([A-Za-z_][A-Za-z0-9_.-]*)([\s\S]*)$/.exec(
          rawTag,
        );
        if (!openingMatch || openingMatch[1].includes(':')) {
          throw new BadRequestException('Invalid SVG document');
        }

        const name = openingMatch[1].toLowerCase();
        const attributes = openingMatch[2].replace(/\/\s*$/, '');
        const selfClosing = /\/\s*$/.test(openingMatch[2]);

        elementCount += 1;
        if (elementCount > MAX_SVG_ELEMENTS || stack.length >= MAX_SVG_DEPTH) {
          throw new BadRequestException('SVG exceeds structural limits');
        }
        if (DISALLOWED_SVG_ELEMENTS.has(name)) {
          throw new BadRequestException(
            'SVG contains active or resource-bearing content that is not allowed',
          );
        }
        if (!ALLOWED_SVG_ELEMENTS.has(name)) {
          throw new BadRequestException(
            `SVG element ${name} is not supported`,
          );
        }

        if (stack.length === 0) {
          if (name !== 'svg' || /\S/.test(body.slice(0, index))) {
            throw new BadRequestException('Invalid SVG document');
          }
          if (selfClosing) rootClosed = true;
        } else if (name === 'svg') {
          throw new BadRequestException('Invalid SVG document');
        }

        this.validateSvgAttributes(attributes);
        if (!selfClosing) stack.push(name);
      }

      index = tagEnd + 1;
    }

    if (stack.length !== 0 || !rootClosed) {
      throw new BadRequestException('Invalid SVG document');
    }
  }

  private findSvgTagEnd(source: string, start: number): number {
    let quote: "'" | '"' | null = null;

    for (let index = start; index < source.length; index += 1) {
      if (index - start > MAX_SVG_TAG_LENGTH) return -1;

      const character = source[index];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === "'" || character === '"') {
        quote = character;
      } else if (character === '>') {
        return index;
      } else if (character === '<') {
        return -1;
      }
    }

    return -1;
  }

  private validateSvgAttributes(input: string): void {
    let remaining = input.trim();
    const names = new Set<string>();

    while (remaining) {
      const match =
        /^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(["'])([\s\S]*?)\2(?=\s|$)/.exec(
          remaining,
        );
      if (!match) {
        throw new BadRequestException('Invalid SVG attributes');
      }

      const name = match[1].toLowerCase();
      const value = match[3];
      if (
        names.has(name) ||
        names.size >= MAX_SVG_ATTRIBUTES_PER_ELEMENT
      ) {
        throw new BadRequestException('Invalid SVG attributes');
      }
      names.add(name);

      if (name === 'xmlns' || name.startsWith('xmlns:')) {
        if (value !== SVG_NAMESPACE && value !== XLINK_NAMESPACE) {
          throw new BadRequestException('SVG contains an external reference');
        }
        remaining = remaining.slice(match[0].length).trim();
        continue;
      }

      if (
        name.includes(':') &&
        name !== 'xlink:href' &&
        name !== 'xml:space' &&
        name !== 'xml:lang'
      ) {
        throw new BadRequestException('SVG contains an external reference');
      }

      if (
        name.startsWith('on') ||
        name === 'style' ||
        name === 'xml:base' ||
        value.includes('<') ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
      ) {
        throw new BadRequestException(
          'SVG contains active or unsafe attributes',
        );
      }

      if (
        URL_ATTRIBUTES.has(name) &&
        !/^#[A-Za-z0-9_.:-]+$/.test(value)
      ) {
        throw new BadRequestException(
          'SVG contains an external or embedded resource',
        );
      }

      if (CSS_URL_ATTRIBUTES.has(name)) {
        const normalizedCssValue = value.replace(/\/\*[\s\S]*?\*\//g, '');
        if (
          (normalizedCssValue.includes('\\') ||
            /\b(?:url|var|attr)\s*\(/i.test(normalizedCssValue)) &&
          !/^url\(\s*#[A-Za-z0-9_.:-]+\s*\)$/i.test(
            normalizedCssValue.trim(),
          )
        ) {
          throw new BadRequestException(
            'SVG contains an external or embedded resource',
          );
        }
      }

      remaining = remaining.slice(match[0].length).trim();
    }
  }

  private async sanitizeSvg(file: Express.Multer.File): Promise<void> {
    const source = this.decodeSvg(file.buffer);
    if (!source) {
      throw new BadRequestException('Invalid or malformed SVG file');
    }

    this.assertSafeSvg(source);

    try {
      const sanitized = await sharp(file.buffer, {
        limitInputPixels: 40_000_000,
        timeout: 5_000,
      })
        .resize({
          width: MAX_SVG_RASTER_DIMENSION,
          height: MAX_SVG_RASTER_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      if (sanitized.length > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`,
        );
      }

      file.buffer = sanitized;
      file.size = sanitized.length;
      file.mimetype = 'image/png';
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid or unsafe SVG file');
    }
  }

  private validateSize(file: Express.Multer.File): void {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes`,
      );
    }
  }

  private rejectByExtension(originalname: string): void {
    const lower = originalname.toLowerCase();
    for (const ext of BLOCKED_EXTENSIONS) {
      if (lower.endsWith(ext)) {
        throw new BadRequestException(`File extension ${ext} is not allowed`);
      }
    }
  }

  private rejectBlockedMimeType(mime: string): void {
    for (const prefix of BLOCKED_MIME_PREFIXES) {
      if (mime.startsWith(prefix)) {
        throw new BadRequestException(`File type ${mime} is not allowed`);
      }
    }
  }

  private async validatePdf(buffer: Buffer): Promise<void> {
    try {
      const pdf = await PDFDocument.load(buffer, {
        updateMetadata: false,
      });

      const catalog = pdf.catalog;
      const namesRef = catalog.get(PDFName.of('Names'));
      if (namesRef) {
        const names = pdf.context.lookup(namesRef) as any;
        if (names && names.get(PDFName.of('EmbeddedFiles'))) {
          throw new BadRequestException(
            'PDF contains embedded files and is not allowed',
          );
        }
      }

      for (const page of pdf.getPages()) {
        const node = page.node as any;
        const actions = node.get(PDFName.of('A')) || node.get(PDFName.of('AA'));
        if (actions) {
          throw new BadRequestException(
            'PDF contains active content (JavaScript/actions) and is not allowed',
          );
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid or malformed PDF file');
    }
  }

  private async stripImageMetadata(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer, {
        limitInputPixels: 40_000_000,
        timeout: 5_000,
      })
        .withMetadata({})
        .toBuffer();
    } catch {
      throw new BadRequestException('Failed to process image metadata');
    }
  }
}
