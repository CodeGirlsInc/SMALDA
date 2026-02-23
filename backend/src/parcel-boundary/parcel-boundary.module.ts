import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParcelBoundary } from './entities/parcel-boundary.entity';
import { ParcelBoundaryController } from './parcel-boundary.controller';
import { ParcelBoundaryService } from './parcel-boundary.service';

@Module({
  imports: [TypeOrmModule.forFeature([ParcelBoundary])],
  controllers: [ParcelBoundaryController],
  providers: [ParcelBoundaryService],
  exports: [ParcelBoundaryService],
})
export class ParcelBoundaryModule {}
