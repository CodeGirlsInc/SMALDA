import { Controller, Get, UseGuards } from "@nestjs/common"
import { RolesGuard } from "./guards/roles.guard"
import { PermissionsGuard } from "./guards/permissions.guard"
import { Roles } from "./decorators/roles.decorator"
import { RequirePermissions } from "./decorators/permissions.decorator"
import { RoleType } from "./entities/role.entity"
import { PermissionAction, PermissionResource } from "./entities/permission.entity"

@Controller("example")
@UseGuards(RolesGuard, PermissionsGuard)
export class ExampleController {
  // Only admins can access this endpoint
  @Get("admin-only")
  @Roles(RoleType.ADMIN)
  adminOnlyEndpoint() {
    return { message: "This is admin only content" }
  }

  // Multiple roles can access this endpoint
  @Get("analysts-and-reviewers")
  @Roles(RoleType.ANALYST, RoleType.REVIEWER)
  analystsAndReviewersEndpoint() {
    return { message: "Content for analysts and reviewers" }
  }

  // Permission-based access control
  @Get("user-management")
  @RequirePermissions(
    { action: PermissionAction.READ, resource: PermissionResource.USER },
    { action: PermissionAction.MANAGE, resource: PermissionResource.USER },
  )
  userManagementEndpoint() {
    return { message: "User management functionality" }
  }

  // Combined role and permission guards
  @Get("admin-user-create")
  @Roles(RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.CREATE, resource: PermissionResource.USER })
  adminUserCreateEndpoint() {
    return { message: "Admin can create users" }
  }

  // Analytics endpoint for analysts
  @Get("analytics")
  @Roles(RoleType.ANALYST, RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.ANALYTICS })
  analyticsEndpoint() {
    return { message: "Analytics data" }
  }

  // Review management for reviewers
  @Get("reviews")
  @Roles(RoleType.REVIEWER, RoleType.ADMIN)
  @RequirePermissions({ action: PermissionAction.READ, resource: PermissionResource.REVIEW })
  reviewsEndpoint() {
    return { message: "Review management" }
  }
}
