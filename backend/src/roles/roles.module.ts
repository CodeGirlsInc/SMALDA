import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Role } from "./entities/role.entity"
import { Permission } from "./entities/permission.entity"
import { RolePermission } from "./entities/role-permission.entity"
import { UserRole } from "./entities/user-role.entity"
import { RolesService } from "./services/roles.service"
import { PermissionsService } from "./services/permissions.service"
import { RolesController } from "./controllers/roles.controller"
import { PermissionsController } from "./controllers/permissions.controller"
import { RolesGuard } from "./guards/roles.guard"
import { PermissionsGuard } from "./guards/permissions.guard"

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission, UserRole])],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsService, RolesGuard, PermissionsGuard],
  exports: [RolesService, PermissionsService, RolesGuard, PermissionsGuard],
})
export class RolesModule {}
