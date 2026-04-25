import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { OwnershipTransferService } from './ownership-transfer.service';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class OwnershipTransferController {
  constructor(private readonly ownershipTransferService: OwnershipTransferService) {}

  @Post(':id/transfer')
  async transferOwnership(
    @Param('id') documentId: string,
    @Request() req,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.ownershipTransferService.transferOwnership(
      documentId,
      req.user.id,
      dto,
    );
  }

  @Get(':id/transfer-history')
  async getTransferHistory(@Param('id') documentId: string) {
    return this.ownershipTransferService.getTransferHistory(documentId);
  }
}
