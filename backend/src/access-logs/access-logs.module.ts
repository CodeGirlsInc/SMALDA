import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AccessLogsService } from "./access-logs.service"
import { AccessLogsController } from "./access-logs.controller"
import { AccessLog } from "./entities/access-log.entity"
import { AccessLogMiddleware } from "./middleware/access-log.middleware"

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog])],
  controllers: [AccessLogsController],
  providers: [AccessLogsService],
  exports: [AccessLogsService],
})
export class AccessLogsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessLogMiddleware).forRoutes("*") // Apply to all routes
  }
}
