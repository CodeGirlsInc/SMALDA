import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccessLogsModule } from './access-logs/access-logs.module';
import { AuthModule } from './auth/auth.module';
import { buildWinstonOptions } from './common/logger.config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware';
import { DocumentsModule } from './documents/documents.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { RiskAssessmentModule } from './risk-assessment/risk-assessment.module';
import { StellarModule } from './stellar/stellar.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { DisputeModule } from './dispute/dispute.module';
import { ExternalValidationModule } from './external-validation/external-validation.module';
import { HealthModule } from './health/health.module';
import { ConfigValidationSchema } from './config/config.validation';

import { MetricsModule } from './metrics/metrics.module';
import { QueueObservabilityModule } from './queue/queue-observability.module';
import { NetworkModule } from './network/network.module';
import { TransferModule } from './transfer/transfer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: ConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get<number>('THROTTLE_TTL', 60000),
        limit: configService.get<number>('THROTTLE_LIMIT', 100),
      }),
      inject: [ConfigService],
    }),
    WinstonModule.forRoot(buildWinstonOptions),
    AuthModule,
    UsersModule,
    DocumentsModule,
    MailModule,
    QueueModule,
    RiskAssessmentModule,
    StellarModule,
    VerificationModule,
    DisputeModule,
    ExternalValidationModule,
    HealthModule,
    AccessLogsModule,
    MetricsModule,
    QueueObservabilityModule,
    NetworkModule,
    TransferModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}