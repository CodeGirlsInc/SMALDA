import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Enforces a maximum upload size on documents to prevent very large
 * files from exhausting server memory or disk.
 */
@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  private readonly maxSizeBytes = 25 * 1024 * 1024;

  transform(file: { size: number }) {
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException(
        `File exceeds maximum allowed size of ${this.maxSizeBytes} bytes`,
      );
    }
    return file;
  }
}
