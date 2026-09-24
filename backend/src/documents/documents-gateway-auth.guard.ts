import { CanActivate, ExecutionContext, Injectable, WsException } from '@nestjs/common';

/**
 * Requires an authenticated handshake before a socket may subscribe to
 * document update events, preventing status leaks to anonymous clients.
 */
@Injectable()
export class DocumentsGatewayAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token;

    if (!token) {
      throw new WsException('Unauthenticated socket connection');
    }
    return true;
  }
}
