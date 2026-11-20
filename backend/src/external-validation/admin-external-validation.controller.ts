import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ExternalValidationService } from './external-validation.service';

@Controller('admin/external-validation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminExternalValidationController {
  constructor(private readonly validationService: ExternalValidationService) {}

  @Get('providers')
  getProviders() {
    return this.validationService.getProvidersHealth();
  }
}
