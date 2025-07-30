import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtCasesService } from './court-cases.service';
import { CourtCasesController } from './court-cases.controller';
import { CourtCase } from './entities/court-case.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourtCase]),
  ],
  controllers: [CourtCasesController],
  providers: [CourtCasesService],
  exports: [CourtCasesService],
})
export class CourtCasesModule {}