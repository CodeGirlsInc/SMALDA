import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StellarService, STELLAR_REDIS } from './stellar.service';
import Redis from 'ioredis';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STELLAR_REDIS,
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL') || 'redis://localhost:6379'),
      inject: [ConfigService],
    },
    StellarService,
  ],
  exports: [StellarService],
})
export class StellarModule {}
