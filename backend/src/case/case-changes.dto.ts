// src/case-change-detector/dto/detect-changes.dto.ts
import { Case } from '../types/case.type';

export class DetectChangesDto {
  oldCase: Case;
  newCase: Case;
}
