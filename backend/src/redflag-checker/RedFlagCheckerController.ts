import { Controller, Post, Body } from '@nestjs/common';
import { RedFlagCheckerService } from './RedFlagCheckerService';
import { LandMetadataDto } from './dto/LandMetadataDto';

@Controller('redflag')
export class RedFlagCheckerController {
  constructor(private readonly checkerService: RedFlagCheckerService) {}

  @Post()
  checkRedFlags(@Body() data: LandMetadataDto) {
    return this.checkerService.checkLand(data);
  }
}
