import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessLog } from './entities/access-log.entity';
import { AccessLogsService } from './access-logs.service';
import { AccessLogsController } from './access-logs.controller';
import { RoleChangeLoggerService } from './role-change-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog])],
  providers: [AccessLogsService, RoleChangeLoggerService],
  controllers: [AccessLogsController],
  exports: [AccessLogsService, RoleChangeLoggerService],
})
export class AccessLogsModule {}

;
