import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { buildWinstonOptions } from './common/logger.config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { DocumentsModule } from './documents/documents.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { RiskAssessmentModule } from './risk-assessment/risk-assessment.module';
import { StellarModule } from './stellar/stellar.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { NotificationPrefsModule } from '../cmmty/notification-prefs/notification-prefs.module';
import { AnalyticsModule } from '../cmmty/analytics/analytics.module';
import { BulkUploadModule } from '../cmmty/bulk-upload/bulk-upload.module';
import { TwoFactorAuthModule } from '../cmmty/two-factor-auth/two-factor-auth.module';
import { RealtimeModule } from '../cmmty/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    `.env.${process.env.NODE_ENV ?? 'development'}`,
    '.env',
  ],
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
    UsersModule,
    AuthModule,
    DocumentsModule,
    RiskAssessmentModule,
    StellarModule,
    VerificationModule,
    MailModule,
    QueueModule,
    NotificationPrefsModule,
    AnalyticsModule,
    BulkUploadModule,
    TwoFactorAuthModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
