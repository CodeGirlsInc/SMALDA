// src/case-change-detector/case-change-detector.service.ts
import { Injectable } from '@nestjs/common';
import { Case } from './types/case.type';

@Injectable()
export class CaseChangeDetectorService {
  detectChanges(oldCase: Case, newCase: Case): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    for (const key of Object.keys(newCase)) {
      if (
        key in oldCase &&
        JSON.stringify(oldCase[key]) !== JSON.stringify(newCase[key])
      ) {
        changes[key] = {
          old: oldCase[key],
          new: newCase[key],
        };
      }
    }

    return changes;
  }
}
