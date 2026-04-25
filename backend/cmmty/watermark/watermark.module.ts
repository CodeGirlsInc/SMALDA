import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatermarkService } from './watermark.service';
import { WatermarkController } from './watermark.controller';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, User])],
  controllers: [WatermarkController],
  providers: [WatermarkService],
  exports: [WatermarkService],
})
export class WatermarkModule {}
