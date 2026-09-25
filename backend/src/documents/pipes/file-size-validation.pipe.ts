import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { DOCUMENT_MAX_FILE_SIZE_BYTES } from '../../common/api-contracts';

/**
 * Enforces a maximum upload size on documents to prevent very large
 * files from exhausting server memory or disk.
 */
@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  private readonly maxSizeBytes = DOCUMENT_MAX_FILE_SIZE_BYTES;

  transform(file: { size: number }) {
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException(
        `File exceeds maximum allowed size of ${this.maxSizeBytes} bytes`,
      );
    }
    return file;
  }
}
