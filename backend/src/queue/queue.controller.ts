import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('queue')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('failed')
  async getFailedJobs() {
    return this.queueService.getFailedJobs();
  }

  @Post('retry/:jobId')
  async retryJob(@Param('jobId') jobId: string) {
    await this.queueService.retryJob(jobId);
    return { message: `Job ${jobId} queued for retry` };
  }

  @Post('reconcile')
  async reconcileStuckJobs() {
    const requeued = await this.queueService.reconcileStuckJobs();
    return { message: `Requeued ${requeued} stuck jobs` };
  }
}
