import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AccessLogsModule } from '../access-logs/access-logs.module';
import { DocumentsModule } from '../documents/documents.module';
import { Dispute } from './entities/dispute.entity';
import { DisputeReason } from './entities/dispute-reason.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { DisputeService } from './dispute.service';
import {
  AdminDisputeController,
  DisputeController,
} from './dispute.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, DisputeReason]),
    NotificationsModule,
    AccessLogsModule,
    DocumentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [DisputeController, AdminDisputeController],
  providers: [DisputeService, DisputeReasonClassifierService, RolesGuard],
  exports: [DisputeService],
})
export class DisputeModule {}
