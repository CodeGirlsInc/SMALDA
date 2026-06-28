import { PaginationDto } from '../../common/dto/pagination.dto';

export class SearchDocumentsDto extends PaginationDto {
  query?: string;
  ownerId?: string;
  status?: string;
  mimeType?: string;
  minRiskScore?: number;
  maxRiskScore?: number;
  archived?: boolean;
  startDate?: string;
  endDate?: string;
}
