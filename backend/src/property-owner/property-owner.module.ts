import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { PropertyOwnerService } from "./property-owner.service"
import { PropertyOwnerController } from "./property-owner.controller"
import { PropertyOwner } from "./entities/property-owner.entity"

@Module({
  imports: [TypeOrmModule.forFeature([PropertyOwner])],
  controllers: [PropertyOwnerController],
  providers: [PropertyOwnerService],
  exports: [PropertyOwnerService], // Export for use in other modules (e.g., DocumentHistory)
})
export class PropertyOwnerModule {}
