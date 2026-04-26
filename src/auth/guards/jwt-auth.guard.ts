import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rely on default passport-jwt logic to validate token and extract user
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Reject subsequent requests if the account has been suspended
    if (user && user.isSuspended) {
      throw new ForbiddenException('Account suspended');
    }

    return true;
  }
}
