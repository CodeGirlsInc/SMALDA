import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentExpiryService } from './document-expiry.service';
import { SetExpiryDto } from './dto/set-expiry.dto';
import { ExpiryStatusDto } from './dto/expiry-status.dto';
import { DocumentExpiry } from './entities/document-expiry.entity';

@ApiTags('Document Expiry')
@Controller('document-expiry')
export class DocumentExpiryController {
  constructor(private readonly documentExpiryService: DocumentExpiryService) {}

  @Post()
  @ApiOperation({
    summary: 'Set or update a document expiry record',
    description:
      'Creates a new expiry record for a document or overwrites an existing one. ' +
      'Resetting the record also clears any previous renewal timestamp.',
  })
  @ApiBody({ type: SetExpiryDto })
  @ApiResponse({
    status: 201,
    description: 'Expiry record created or updated.',
    type: DocumentExpiry,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or malformed date.' })
  setExpiry(@Body() dto: SetExpiryDto): Promise<DocumentExpiry> {
    return this.documentExpiryService.setExpiry(dto);
  }

  @Get('expiring-soon')
  @ApiOperation({
    summary: 'Get documents expiring within N days',
    description:
      'Returns all non-renewed documents whose expiry date falls within the next `withinDays` days, ' +
      'sorted from soonest to latest.',
  })
  @ApiQuery({
    name: 'withinDays',
    description: 'Number of days to look ahead (must be ≥ 1)',
    required: true,
    example: 30,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of expiry records approaching their expiry date.',
    type: [DocumentExpiry],
  })
  @ApiResponse({ status: 400, description: 'withinDays must be at least 1.' })
  getExpiringSoon(
    @Query('withinDays', ParseIntPipe) withinDays: number,
  ): Promise<DocumentExpiry[]> {
    return this.documentExpiryService.getExpiringSoon(withinDays);
  }

  @Get('expired')
  @ApiOperation({
    summary: 'Get all expired documents',
    description:
      'Returns all documents whose expiry date is in the past and have never been renewed, ' +
      'ordered from oldest expiry first.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of expired and unrenewed expiry records.',
    type: [DocumentExpiry],
  })
  getExpired(): Promise<DocumentExpiry[]> {
    return this.documentExpiryService.getExpired();
  }

  @Get(':documentId')
  @ApiOperation({
    summary: 'Check expiry status for a single document',
    description:
      'Returns the full expiry record, days until expiry (negative if past), ' +
      'and a status label: EXPIRED | EXPIRING_SOON | VALID.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'UUID of the document to check',
    example: 'b3d2c1a0-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 200,
    description: 'Expiry status for the document.',
    type: ExpiryStatusDto,
  })
  @ApiResponse({ status: 404, description: 'No expiry record found for this document.' })
  checkExpiry(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<ExpiryStatusDto> {
    return this.documentExpiryService.checkExpiry(documentId);
  }

  @Patch(':documentId/renew')
  @ApiOperation({
    summary: 'Mark a document as renewed',
    description:
      'Sets renewedAt to the current timestamp and advances expiryDate forward ' +
      'by the stored renewalPeriodDays. Returns the updated expiry record.',
  })
  @ApiParam({
    name: 'documentId',
    description: 'UUID of the document to renew',
    example: 'b3d2c1a0-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 200,
    description: 'Document marked as renewed with updated expiry date.',
    type: DocumentExpiry,
  })
  @ApiResponse({ status: 404, description: 'No expiry record found for this document.' })
  markRenewed(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentExpiry> {
    return this.documentExpiryService.markRenewed(documentId);
  }
}
