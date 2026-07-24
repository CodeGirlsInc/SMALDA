import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { DocumentsService } from '../documents/documents.service';
import { ExternalValidationService } from './external-validation.service';
import { CreateValidationRequestDto } from './dto/validation-request.dto';
import { ValidationType } from './entities/validation-request.entity';

@Controller('documents/:id/external-validation')
@UseGuards(JwtAuthGuard)
export class ExternalValidationController {
  constructor(
    private readonly validationService: ExternalValidationService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post()
  async createValidation(
    @Param('id') documentId: string,
    @Body()
    body: {
      validationType: ValidationType;
      requestPayload?: Record<string, any>;
      metadata?: Record<string, any>;
    },
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
    @Param('id') documentId: string,
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
