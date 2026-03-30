import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { VerificationResponseDto } from './dto/verification-response.dto';

@ApiTags('Verifications')
@ApiBearerAuth('JWT-auth')
@Controller('verifications')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  @ApiResponse({ status: 200, type: VerificationResponseDto, isArray: true })
  list(@Query() pagination: PaginationDto) {
    return this.verificationService.findAll(pagination.page ?? 1, pagination.limit ?? 20);
  }
}
