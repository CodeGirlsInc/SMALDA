import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';

const mockReflector = (roles: UserRole[] | undefined) => ({
  getAllAndOverride: jest.fn().mockReturnValue(roles),
});

const mockContext = (role: UserRole | undefined): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext);

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const guard = new RolesGuard(mockReflector(undefined) as unknown as Reflector);
    expect(guard.canActivate(mockContext(UserRole.USER))).toBe(true);
  });

  it('allows ADMIN to access an ADMIN-only route', () => {
    const guard = new RolesGuard(
      mockReflector([UserRole.ADMIN]) as unknown as Reflector,
    );
    expect(guard.canActivate(mockContext(UserRole.ADMIN))).toBe(true);
  });

  it('throws ForbiddenException when USER tries to access ADMIN-only route', () => {
    const guard = new RolesGuard(
      mockReflector([UserRole.ADMIN]) as unknown as Reflector,
    );
    expect(() => guard.canActivate(mockContext(UserRole.USER))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when user is undefined', () => {
    const guard = new RolesGuard(
      mockReflector([UserRole.ADMIN]) as unknown as Reflector,
    );
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows USER to access a USER-allowed route', () => {
    const guard = new RolesGuard(
      mockReflector([UserRole.USER, UserRole.ADMIN]) as unknown as Reflector,
    );
    expect(guard.canActivate(mockContext(UserRole.USER))).toBe(true);
  });
});