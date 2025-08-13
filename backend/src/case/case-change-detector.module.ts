// src/case-change-detector/case-change-detector.module.ts
import { Module } from '@nestjs/common';
import { CaseChangeDetectorService } from './case-change-detector.service';

@Module({
  providers: [CaseChangeDetectorService],
  exports: [CaseChangeDetectorService],
})
export class CaseChangeDetectorModule {}
