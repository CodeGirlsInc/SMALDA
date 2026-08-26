```
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessLog } from './entities/access-log.entity';
import { AccessLogsService } from './access-logs.service';
import { AccessLogsController } from './access-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog])],
  providers: [AccessLogsService],
  controllers: [AccessLogsController],
  exports: [AccessLogsService],
})
export class AccessLogsModule {}

```;
