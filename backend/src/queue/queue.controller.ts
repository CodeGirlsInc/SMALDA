import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueueService } from './queue.service';

// BE-27: Queue monitoring endpoints for admins
@Controller('queue')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  getStats() {
    return this.queueService.getStats();
  }

  @Get('failed')
  getFailedJobs() {
    return this.queueService.getFailedJobs();
  }

  @Get('dlq')
  getDLQJobs() {
    return this.queueService.getDLQJobs();
  }
}
