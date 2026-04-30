export class CreateAccessLogDto {
  userId?: string;
  routePath: string;
  httpMethod: string;
  ipAddress?: string;
}
