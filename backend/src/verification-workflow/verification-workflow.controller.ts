import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InitiateWorkflowDto } from './dto/initiate-workflow.dto';
import { RecordAnchorDto } from './dto/record-anchor.dto';
import { TransitionWorkflowDto } from './dto/transition-workflow.dto';
import { VerificationWorkflow } from './entities/verification-workflow.entity';
import { WorkflowState } from './enums/workflow-state.enum';
import { VerificationWorkflowService } from './verification-workflow.service';

@ApiTags('Verification Workflows')
@Controller('verification-workflows')
export class VerificationWorkflowController {
  constructor(
    private readonly verificationWorkflowService: VerificationWorkflowService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Initiate a new verification workflow for a document' })
  @ApiResponse({ status: 201, description: 'Workflow created in SUBMITTED state', type: VerificationWorkflow })
  initiate(@Body() dto: InitiateWorkflowDto): Promise<VerificationWorkflow> {
    return this.verificationWorkflowService.initiate(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all workflows, optionally filtered by state' })
  @ApiQuery({
    name: 'state',
    enum: WorkflowState,
    required: false,
    description: 'Filter results to a specific workflow state',
  })
  @ApiResponse({ status: 200, description: 'List of workflows', type: [VerificationWorkflow] })
  findAll(@Query('state') state?: WorkflowState): Promise<VerificationWorkflow[]> {
    return this.verificationWorkflowService.findAll(state);
  }

  @Get('document/:documentId')
  @ApiOperation({ summary: 'Get the current workflow status for a document' })
  @ApiParam({ name: 'documentId', description: 'UUID of the document' })
  @ApiResponse({ status: 200, description: 'Most recent workflow for the document', type: VerificationWorkflow })
  findByDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<VerificationWorkflow | null> {
    return this.verificationWorkflowService.findByDocument(documentId);
  }

  @Patch(':id/transition')
  @ApiOperation({ summary: 'Move a workflow to a new state (enforces valid transitions)' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow' })
  @ApiResponse({ status: 200, description: 'Workflow after the transition', type: VerificationWorkflow })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionWorkflowDto,
  ): Promise<VerificationWorkflow> {
    return this.verificationWorkflowService.transition(id, dto);
  }

  @Patch(':id/anchor')
  @ApiOperation({ summary: 'Record a Stellar anchor and mark the workflow as ANCHORED' })
  @ApiParam({ name: 'id', description: 'UUID of the workflow' })
  @ApiResponse({ status: 200, description: 'Workflow marked as ANCHORED with transaction ID', type: VerificationWorkflow })
  @ApiResponse({ status: 400, description: 'Workflow is not in AWAITING_BLOCKCHAIN state' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  recordAnchor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordAnchorDto,
  ): Promise<VerificationWorkflow> {
    return this.verificationWorkflowService.recordAnchor(id, dto);
  }
}
