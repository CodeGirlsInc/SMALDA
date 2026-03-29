import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from '../documents/documents.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * POST /api/transfers
   * Create a new ownership transfer, anchor it on Stellar, and persist the record.
   */
  @Post('transfers')
  async createTransfer(@Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto);
  }

  /**
   * GET /api/documents/:id/transfers
   * Return the full transfer history for a document in chronological order.
   */
  @Get('documents/:id/transfers')
  async getDocumentTransfers(@Param('id') id: string) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return this.transfersService.findByDocument(id);
  }
}
