import { Module } from '@nestjs/common';
import { OwnershipTransferEventService } from './ownership-transfer-event.service';

/** #1560: AppModule imports this module; it provides the ownership-transfer event service. */
@Module({
  providers: [OwnershipTransferEventService],
  exports: [OwnershipTransferEventService],
})
export class TransferModule {}
