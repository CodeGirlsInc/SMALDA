import { Controller, Get, Post, Param, Delete, Res, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import type { TrainingExportService } from "../services/training-export.service"
import type { ExportTrainingDataDto } from "../dto/export-training-data.dto"
import { RolesGuard } from "../../roles/guards/roles.guard"
import { PermissionsGuard } from "../../roles/guards/permissions.guard"
import { Roles } from "../../roles/decorators/roles.decorator"
import { RequirePermissions } from "../../roles/decorators/permissions.decorator"
import { RoleType } from "../../roles/entities/role.entity"
import { PermissionAction, PermissionResource } from "../../roles/entities/permission.entity"

@Controller("ml-training/exports")
@UseGuards(RolesGuard, PermissionsGuard)
export class TrainingExportController {
  constructor(private readonly trainingExportService: TrainingExportService) {}

  @Post()
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.ANALYTICS })
  create(exportDto: ExportTrainingDataDto & { exportedBy: string; exporterName: string }) {
    return this.trainingExportService.createExport(exportDto, exportDto.exportedBy, exportDto.exporterName)
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findAll() {
    return this.trainingExportService.findAll()
  }

  @Get(":id")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  findOne(@Param("id") id: string) {
    return this.trainingExportService.findOne(id)
  }

  @Get(":id/download")
  @Roles(RoleType.ADMIN, RoleType.ANALYST)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  async download(@Param("id") id: string, @Res() res: Response) {
    const { filePath, fileName } = await this.trainingExportService.downloadExport(id)

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
    res.setHeader("Content-Type", "application/octet-stream")

    return res.sendFile(filePath)
  }

  @Delete(":id")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.DELETE, resource: PermissionResource.ANALYTICS })
  remove(@Param("id") id: string) {
    return this.trainingExportService.remove(id)
  }
}
