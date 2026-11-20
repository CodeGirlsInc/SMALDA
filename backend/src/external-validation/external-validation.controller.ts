import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { DocumentsService } from '../documents/documents.service';
import { ExternalValidationService } from './external-validation.service';
import {
  CreateExternalValidationBodyDto,
  CreateValidationRequestDto,
} from './dto/validation-request.dto';

@Controller('documents/:id/external-validation')
@UseGuards(JwtAuthGuard)
export class ExternalValidationController {
  constructor(
    private readonly validationService: ExternalValidationService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post()
  async createValidation(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Body()
    body: CreateExternalValidationBodyDto,
    @Req() req: Request & { user?: User },
  ) {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const user = req.user!;
    if (document.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this document');
    }

    const createDto: CreateValidationRequestDto = {
      documentId,
      validationType: body.validationType,
      requestPayload: body.requestPayload,
      requestedBy: user.id,
      metadata: body.metadata,
    };

    return this.validationService.createValidationRequest(createDto);
  }

  @Get()
  async getLatestValidation(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Req() req: Request & { user?: User },
  ) {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const user = req.user!;
    if (document.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this document');
    }

    const results = await this.validationService.findByDocument(documentId);
    return results.length > 0 ? results[0] : null;
  }
}
