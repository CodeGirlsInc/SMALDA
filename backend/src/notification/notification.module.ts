import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { NotificationController } from "./notification.controller"
import { NotificationService } from "./notification.service"
import { Notification } from "./entities/notification.entity"
import { EmailService } from "./services/email.service"
import { TemplateService } from "./services/template.service"
import { NotificationProcessor } from "./processors/notification.processor"

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    BullModule.registerQueue({
      name: "notification",
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, EmailService, TemplateService, NotificationProcessor],
  exports: [NotificationService],
})
export class NotificationModule {}
