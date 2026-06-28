import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { ScheduleModule } from '@nestjs/schedule';

import { AdminModule } from './admin/admin.module';
import { ApprovalModule } from './approval/approval.module';
import { AdminVerificationsModule } from './admin-verifications/admin-verifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { I18nModule } from './i18n/i18n.module';
import { HealthModule } from './health/health.module';
import { buildWinstonOptions } from './common/logger.config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { DocumentsModule } from './documents/documents.module';
import { GatewayModule } from './gateway/gateway.module';
import { CacheModule } from './cache/cache.module';
import { DocumentsModule } from './documents/documents.module';
import { ExportModule } from './export/export.module';
import { ExternalValidationModule } from './external-validation/external-validation.module';
import { MailModule } from './mail/mail.module';
import { OrganizationModule } from './organization/organization.module';
import { QueueModule } from './queue/queue.module';
import { RiskAssessmentModule } from './risk-assessment/risk-assessment.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SharingModule } from './sharing/sharing.module';
import { StellarModule } from './stellar/stellar.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { ConfigValidationSchema } from './config/config.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validationSchema: ConfigValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildWinstonOptions(config.get<string>('LOG_LEVEL') || undefined),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        database: configService.get('DATABASE_NAME'),
        password: configService.get('DATABASE_PASSWORD'),
        username: configService.get('DATABASE_USER'),
        port: +configService.get('DATABASE_PORT'),
        host: configService.get('DATABASE_HOST'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    DocumentsModule,
    GatewayModule,
    AdminModule,
    I18nModule,
    ApprovalModule,
    AuditModule,
    AdminVerificationsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    DocumentsModule,
    ExternalValidationModule,
    RiskAssessmentModule,
    SchedulerModule,
    StellarModule,
    VerificationModule,
    MailModule,
    QueueModule,
    OrganizationModule,
    ExportModule,
    CacheModule,
    SharingModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerMiddleware, CorrelationIdMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*')
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
