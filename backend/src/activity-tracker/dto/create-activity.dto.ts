export class CreateActivityDto {
  userId: string;
  actionType: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}
