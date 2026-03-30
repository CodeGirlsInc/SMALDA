import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VerificationResponseDto } from './dto/verification-response.dto';
import { QueryVerificationsDto } from './dto/query-verifications.dto';

@ApiTags('Verifications')
@ApiBearerAuth('JWT-auth')
@Controller('verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiResponse({ status: 200, type: VerificationResponseDto, isArray: true })
  list(@Query() query: QueryVerificationsDto) {
    return this.verificationService.findAllWithFilters(query);
  }
}
