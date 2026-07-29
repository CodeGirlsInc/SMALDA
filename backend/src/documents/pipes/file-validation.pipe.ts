import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(value: Express.Multer.File) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    if (value.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(value.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    return value;
  }
}
