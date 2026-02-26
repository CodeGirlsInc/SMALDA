import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RiskIndicatorModule } from './risk-indicator/risk-indicator.module';
import { DocumentUploadModule } from './document-upload/document-upload.module';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    RiskIndicatorModule,
    DocumentUploadModule,
    NotificationModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
