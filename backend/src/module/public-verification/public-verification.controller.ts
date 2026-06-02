import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { PublicVerificationService } from './public-verification.service';

@Controller('module')
@UseGuards(ThrottlerGuard)
export class PublicVerificationController {
  constructor(
    private readonly publicVerificationService: PublicVerificationService,
  ) {}

  @Get('verify/:hash')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async verify(@Param('hash') hash: string) {
    const normalizedHash = hash.trim().toLowerCase();

    if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
      throw new BadRequestException(
        'Hash must be a 64-character hexadecimal string',
      );
    }

    return this.publicVerificationService.verifyHash(normalizedHash);
  }
}
