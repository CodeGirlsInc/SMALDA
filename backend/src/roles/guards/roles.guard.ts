import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { RoleType } from "../entities/role.entity"
import type { RolesService } from "../services/roles.service"
import { ROLES_KEY } from "../decorators/roles.decorator"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user || !user.id) {
      return false
    }

    const userRoles = await this.rolesService.getUserRoles(user.id)
    const userRoleNames = userRoles.map((role) => role.name)

    return requiredRoles.some((role) => userRoleNames.includes(role))
  }
}
