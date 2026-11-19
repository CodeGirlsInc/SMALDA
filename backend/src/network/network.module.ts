import { Module } from '@nestjs/common';
import { NetworkController } from './network.controller';
import { NetworkMismatchGuard } from './network-mismatch.guard';

/** #1560: AppModule imports this module; it registers the network controller and guard. */
@Module({
  controllers: [NetworkController],
  providers: [NetworkMismatchGuard],
  exports: [NetworkMismatchGuard],
})
export class NetworkModule {}
