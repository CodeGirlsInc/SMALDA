import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalValidationService } from './external-validation.service';
import {
  ValidationRequest,
  ValidationProvider,
} from './entities/validation-request.entity';
import { LandRegistryProvider } from './providers/land-registry.provider';
import { GovernmentIdProvider } from './providers/government-id.provider';
import { BusinessRegistrationProvider } from './providers/business-registration.provider';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRequest, ValidationProvider])],
  providers: [
    ExternalValidationService,
    LandRegistryProvider,
    GovernmentIdProvider,
    BusinessRegistrationProvider,
  ],
  exports: [ExternalValidationService],
})
export class ExternalValidationModule {}
