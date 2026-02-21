import { LandRecord } from '../../land-record/entities/land-record.entity';

export interface SearchResult {
  data: LandRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
