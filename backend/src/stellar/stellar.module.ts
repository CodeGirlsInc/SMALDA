import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { StellarController } from './stellar.controller';
import { StellarService } from './stellar.service';
import { StellarTransaction } from './entities/stellar-transaction.entity';
import { StellarAccount } from './entities/stellar-account.entity';
import { StellarExceptionFilter } from './filters/stellar-exception.filter';
import { StellarLoggingInterceptor } from './interceptors/stellar-logging.interceptor';
import { StellarValidationPipe, StellarSanitizationPipe } from './pipes/stellar-validation.pipe';
import stellarConfig from './config/stellar.config.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([StellarTransaction, StellarAccount]),
    ConfigModule.forFeature(stellarConfig),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 100,
    }]),
  ],
  controllers: [StellarController],
  providers: [
    StellarService,
    {
      provide: APP_FILTER,
      useClass: StellarExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StellarLoggingInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: StellarValidationPipe,
    },
    {
      provide: APP_PIPE,
      useClass: StellarSanitizationPipe,
    },
  ],
  exports: [StellarService],
})
export class StellarModule {}
