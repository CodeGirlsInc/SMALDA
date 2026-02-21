import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentUploadService } from './document-upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Document Upload')
@Controller('documents')
export class DocumentUploadController {
  constructor(private readonly documentUploadService: DocumentUploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a land ownership document (PDF or image)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF, JPEG, or PNG file (max 10 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully. Returns stored document metadata.',
    type: UploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No file provided or unsupported file type.' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.documentUploadService.saveUpload(file);
  }
}
