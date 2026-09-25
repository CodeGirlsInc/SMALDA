import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { DOCUMENT_ALLOWED_MIME_TYPES } from '../../common/api-contracts';

/**
 * Restricts document uploads to an explicit MIME-type allowlist so
 * arbitrary file types can't be uploaded as "documents".
 */
@Injectable()
export class MimeTypeValidationPipe implements PipeTransform {
  private readonly allowedMimeTypes = DOCUMENT_ALLOWED_MIME_TYPES;

  transform(file: { mimetype: string }) {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    return file;
  }
}
