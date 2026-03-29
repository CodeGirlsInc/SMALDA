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
import { TransfersModule } from './transfers/transfers.module';
import { VerificationModule } from './verification/verification.module';
import { validateConfig } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateConfig,
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
        synchronize: false,
        migrations: ['dist/migrations/*.js'],
        migrationsRun: false,
      }),
    }),
    UsersModule,
    AuthModule,
    DocumentsModule,
    RiskAssessmentModule,
    StellarModule,
    VerificationModule,
    TransfersModule,
    MailModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
