import { Injectable } from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';

@Injectable()
export class RoleChangeLoggerService {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  async logRoleChange(
    userId: string,
    previousRole: string,
    newRole: string,
    changedBy: string,
  ): Promise<void> {
    await this.accessLogsService.create({
      userId,
      routePath: `users/${userId}/role ${previousRole}->${newRole} by ${changedBy}`,
      httpMethod: 'PATCH',
      ipAddress: 'internal',
      statusCode: 200,
    });
  }
}
