import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnershipTransferService } from './ownership-transfer.service';
import { OwnershipTransferController } from './ownership-transfer.controller';
import { OwnershipTransfer } from './entities/ownership-transfer.entity';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OwnershipTransfer, Document, User])],
  controllers: [OwnershipTransferController],
  providers: [OwnershipTransferService],
  exports: [OwnershipTransferService],
})
export class OwnershipTransferModule {}
