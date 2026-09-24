import { Injectable } from '@nestjs/common';

/**
 * Records role change events to access-logs so privilege changes remain
 * auditable, closing the gap where role updates left no trace.
 */
@Injectable()
export class RoleChangeLoggerService {
  constructor(private readonly accessLogsService: { create: (entry: unknown) => Promise<unknown> }) {}

  async logRoleChange(userId: string, previousRole: string, newRole: string, changedBy: string) {
    return this.accessLogsService.create({
      action: 'ROLE_CHANGE',
      userId,
      changedBy,
      previousRole,
      newRole,
      timestamp: new Date().toISOString(),
    });
  }
}
