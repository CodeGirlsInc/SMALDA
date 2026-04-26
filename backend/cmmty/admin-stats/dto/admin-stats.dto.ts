import { DocumentStatus } from '../../../src/documents/entities/document.entity';

export interface DocumentsByStatusCount {
  status: DocumentStatus;
  count: number;
}

export class AdminStatsDto {
  totalUsers: number;
  totalDocuments: number;
  documentsByStatus: DocumentsByStatusCount[];
  averageRiskScore: number | null;
  highRiskCount: number;
}
