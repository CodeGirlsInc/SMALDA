import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BatchSubmissionService } from './batch-submission.service';
import { BatchJob } from './entities/batch-job.entity';

@ApiTags('Batch Submission')
@Controller('batch')
export class BatchSubmissionController {
  constructor(
    private readonly batchSubmissionService: BatchSubmissionService,
  ) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiOperation({
    summary: 'Upload and process a batch of land documents',
    description:
      'Accepts up to 20 PDF or image files. Each file is saved, hashed (SHA-256), and the batch result is returned synchronously.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description:
            'Land document files to submit (PDF, JPEG, PNG — max 10 MB each, up to 20 files per batch)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Batch submitted and processed. Returns the completed batch job record with per-document results.',
    type: BatchJob,
  })
  @ApiResponse({
    status: 400,
    description:
      'No files provided, batch exceeds 20 files, or unsupported file type.',
  })
  async createBatch(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<BatchJob> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be provided');
    }

    return this.batchSubmissionService.createBatch(files);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get batch job status',
    description:
      'Returns the current status and per-document processing results for the given batch job ID.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the batch job', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Batch job found.',
    type: BatchJob,
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format.' })
  @ApiResponse({ status: 404, description: 'Batch job not found.' })
  getBatchStatus(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BatchJob> {
    return this.batchSubmissionService.getBatchStatus(id);
  }
}
