import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { UserRole } from "../entities/user.entity"
import type { Request } from "express"

export const ROLES_KEY = "roles"
export const Roles = (...roles: UserRole[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(ROLES_KEY, roles, descriptor?.value || target)
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()

    // In a real application, you would extract user from JWT token or session
    // For this example, we'll use headers to simulate authentication
    const userRole = request.headers["x-user-role"] as UserRole
    const userId = request.headers["x-user-id"] as string

    if (!userRole || !userId) {
      throw new ForbiddenException("Authentication required")
    }

    const hasRole = requiredRoles.some((role) => userRole === role)

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(", ")}`)
    }

    return true
  }
}
