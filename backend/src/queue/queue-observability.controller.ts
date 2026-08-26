import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueueService } from './queue.service';

@ApiTags('queue')
@Controller('queue')
export class QueueObservabilityController {
  constructor(private readonly queueService: QueueService) {}

  @Get('dead-letter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List dead-letter and failed jobs' })
  async getDeadLetterJobs() {
    const queue = this.queueService.getQueue();
    const failedJobs = await queue.getFailed();
    return {
      count: failedJobs.length,
      jobs: failedJobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        failedAt: job.finishedOn,
      })),
    };
  }

  @Post('dead-letter/:id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Requeue a dead-lettered job' })
  async retryDeadLetterJob(@Param('id') id: string) {
    const queue = this.queueService.getQueue();
    const job = await queue.getJob(id);

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    if (job.finishedOn === undefined && job.failedReason === undefined) {
      throw new BadRequestException(`Job ${id} is not in a failed state`);
    }

    await job.retry();
    return { status: 'requeued', jobId: id };
  }
}
