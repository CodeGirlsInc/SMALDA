import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandRecord } from './entities/land-record.entity';
import { LandRecordController } from './land-record.controller';
import { LandRecordService } from './land-record.service';

@Module({
  imports: [TypeOrmModule.forFeature([LandRecord])],
  controllers: [LandRecordController],
  providers: [LandRecordService],
  exports: [LandRecordService],
})
export class LandRecordModule {}
