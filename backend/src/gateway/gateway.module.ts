import { Module } from '@nestjs/common';
import { DocumentsGateway } from './documents.gateway';

@Module({
  providers: [DocumentsGateway],
  exports: [DocumentsGateway],
})
export class GatewayModule {}
