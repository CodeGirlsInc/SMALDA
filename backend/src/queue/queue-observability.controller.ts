import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('queue')
@Controller('queue')
export class QueueObservabilityController {
  private failedJobs = [
    { id: 'job-101', name: 'anchor-document', error: 'Stellar network timeout', attemptsMade: 3, failedAt: new Date() },
  ];

  @Get('failed')
  @ApiOperation({ summary: 'List dead-letter and failed jobs' })
  getFailedJobs() {
    return { count: this.failedJobs.length, jobs: this.failedJobs };
  }

  @Post('retry/:id')
  @ApiOperation({ summary: 'Manually retry a failed job' })
  retryJob(@Param('id') id: string) {
    this.failedJobs = this.failedJobs.filter((j) => j.id !== id);
    return { status: 'requeued', jobId: id };
  }
}
