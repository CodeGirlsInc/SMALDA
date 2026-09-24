import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Restricts document uploads to an explicit MIME-type allowlist so
 * arbitrary file types can't be uploaded as "documents".
 */
@Injectable()
export class MimeTypeValidationPipe implements PipeTransform {
  private readonly allowedMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
  ];

  transform(file: { mimetype: string }) {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    return file;
  }
}
