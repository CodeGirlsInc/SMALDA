import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConfigModule } from "@nestjs/config"
import { ExternalValidationController } from "./external-validation.controller"
import { ExternalValidationService } from "./external-validation.service"
import { ValidationRequest } from "./entities/validation-request.entity"
import { ValidationProvider } from "./entities/validation-provider.entity"
import { LandRegistryProvider } from "./providers/land-registry.provider"
import { GovernmentIdProvider } from "./providers/government-id.provider"
import { BusinessRegistrationProvider } from "./providers/business-registration.provider"

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRequest, ValidationProvider]), ConfigModule],
  controllers: [ExternalValidationController],
  providers: [ExternalValidationService, LandRegistryProvider, GovernmentIdProvider, BusinessRegistrationProvider],
  exports: [ExternalValidationService],
})
export class ExternalValidationModule {}
