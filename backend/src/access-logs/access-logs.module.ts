import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessLog } from './entities/access-log.entity';
import { AccessLogsService } from './access-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog])],
  providers: [AccessLogsService],
  exports: [AccessLogsService],
})
export class AccessLogsModule {}
