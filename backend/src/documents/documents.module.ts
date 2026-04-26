import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { StellarModule } from '../stellar/stellar.module';
import { VerificationModule } from '../verification/verification.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Document]),
    StellarModule,
    VerificationModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
// hhhh
