import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerificationWorkflow,
  WorkflowHistoryEntry,
} from './entities/verification-workflow.entity';
import { InitiateWorkflowDto } from './dto/initiate-workflow.dto';
import { TransitionWorkflowDto } from './dto/transition-workflow.dto';
import { RecordAnchorDto } from './dto/record-anchor.dto';
import {
  TERMINAL_STATES,
  VALID_TRANSITIONS,
  WorkflowState,
} from './enums/workflow-state.enum';

@Injectable()
export class VerificationWorkflowService {
  constructor(
    @InjectRepository(VerificationWorkflow)
    private readonly workflowRepository: Repository<VerificationWorkflow>,
  ) {}

  async initiate(dto: InitiateWorkflowDto): Promise<VerificationWorkflow> {
    const initialEntry: WorkflowHistoryEntry = {
      state: WorkflowState.SUBMITTED,
      timestamp: new Date().toISOString(),
      note: 'Workflow initiated',
    };

    const workflow = this.workflowRepository.create({
      documentId: dto.documentId,
      currentState: WorkflowState.SUBMITTED,
      history: [initialEntry],
    });

    return this.workflowRepository.save(workflow);
  }

  async transition(
    workflowId: string,
    dto: TransitionWorkflowDto,
  ): Promise<VerificationWorkflow> {
    const workflow = await this.findWorkflowOrFail(workflowId);
    const { newState, note } = dto;

    this.assertValidTransition(workflow.currentState, newState);

    const historyEntry: WorkflowHistoryEntry = {
      state: newState,
      timestamp: new Date().toISOString(),
      ...(note && { note }),
    };

    workflow.currentState = newState;
    workflow.history = [...workflow.history, historyEntry];

    if (TERMINAL_STATES.has(newState)) {
      workflow.completedAt = new Date();
    }

    return this.workflowRepository.save(workflow);
  }

  async findByDocument(documentId: string): Promise<VerificationWorkflow | null> {
    return this.workflowRepository.findOne({
      where: { documentId },
      order: { submittedAt: 'DESC' },
    });
  }

  async findAll(state?: WorkflowState): Promise<VerificationWorkflow[]> {
    const where = state ? { currentState: state } : {};
    return this.workflowRepository.find({
      where,
      order: { submittedAt: 'DESC' },
    });
  }

  async recordAnchor(
    workflowId: string,
    dto: RecordAnchorDto,
  ): Promise<VerificationWorkflow> {
    const workflow = await this.findWorkflowOrFail(workflowId);

    this.assertValidTransition(workflow.currentState, WorkflowState.ANCHORED);

    const historyEntry: WorkflowHistoryEntry = {
      state: WorkflowState.ANCHORED,
      timestamp: new Date().toISOString(),
      note: `Anchored on Stellar — tx: ${dto.stellarTransactionId}`,
    };

    workflow.currentState = WorkflowState.ANCHORED;
    workflow.stellarTransactionId = dto.stellarTransactionId;
    workflow.completedAt = new Date();
    workflow.history = [...workflow.history, historyEntry];

    return this.workflowRepository.save(workflow);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async findWorkflowOrFail(id: string): Promise<VerificationWorkflow> {
    const workflow = await this.workflowRepository.findOne({ where: { id } });
    if (!workflow) {
      throw new NotFoundException(`Verification workflow with ID ${id} not found`);
    }
    return workflow;
  }

  private assertValidTransition(
    from: WorkflowState,
    to: WorkflowState,
  ): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid state transition: ${from} → ${to}. ` +
          `Allowed: [${allowed.join(', ') || 'none — this is a terminal state'}]`,
      );
    }
  }
}
