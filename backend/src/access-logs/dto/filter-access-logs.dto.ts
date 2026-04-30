export class FilterAccessLogsDto {
  page?: number;
  limit?: number;
  sortByDateDesc?: boolean;
  userId?: string;
  routePath?: string;
  httpMethod?: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
}
