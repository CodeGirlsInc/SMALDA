import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditLogService, PaginatedAuditLogs } from './audit-log.service';
import { AuditLog } from './entities/audit-log.entity';
import { PaginateAuditLogDto } from './dto/paginate-audit-log.dto';

@ApiTags('Audit Logs')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated list of all audit log entries' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  findAll(@Query() pagination: PaginateAuditLogDto): Promise<PaginatedAuditLogs> {
    return this.auditLogService.findAll(pagination);
  }

  @Get('action/:action')
  @ApiOperation({ summary: 'Get all audit log entries for a specific action type' })
  @ApiParam({
    name: 'action',
    description: 'Action name, e.g. DOCUMENT_UPLOADED or WORKFLOW_TRANSITIONED',
    example: 'DOCUMENT_UPLOADED',
  })
  @ApiResponse({ status: 200, description: 'Audit log entries for the action', type: [AuditLog] })
  findByAction(@Param('action') action: string): Promise<AuditLog[]> {
    return this.auditLogService.findByAction(action);
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Get all audit log entries for a specific entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type, e.g. LandRecord or UploadedDocument', example: 'LandRecord' })
  @ApiParam({ name: 'entityId', description: 'ID of the entity', example: 'b3d2c1a0-...' })
  @ApiResponse({ status: 200, description: 'Audit log entries for the entity', type: [AuditLog] })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findByEntity(entityType, entityId);
  }
}
