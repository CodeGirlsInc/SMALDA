import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsGateway } from './documents.gateway';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { StellarModule } from '../stellar/stellar.module';
import { VerificationModule } from '../verification/verification.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Document]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    StellarModule,
    forwardRef(() => VerificationModule),
    forwardRef(() => QueueModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsGateway],
  exports: [DocumentsService, DocumentsGateway],
})
export class DocumentsModule {}
// hhhh
