export enum WorkflowState {
  SUBMITTED = 'SUBMITTED',
  HASHING = 'HASHING',
  ANALYZING = 'ANALYZING',
  AWAITING_BLOCKCHAIN = 'AWAITING_BLOCKCHAIN',
  ANCHORED = 'ANCHORED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

/** Terminal states — no further transitions are allowed from these. */
export const TERMINAL_STATES = new Set<WorkflowState>([
  WorkflowState.ANCHORED,
  WorkflowState.FAILED,
  WorkflowState.REJECTED,
]);

/** Defines which states a workflow may move to from each given state. */
export const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  [WorkflowState.SUBMITTED]: [
    WorkflowState.HASHING,
    WorkflowState.FAILED,
    WorkflowState.REJECTED,
  ],
  [WorkflowState.HASHING]: [WorkflowState.ANALYZING, WorkflowState.FAILED],
  [WorkflowState.ANALYZING]: [
    WorkflowState.AWAITING_BLOCKCHAIN,
    WorkflowState.FAILED,
    WorkflowState.REJECTED,
  ],
  [WorkflowState.AWAITING_BLOCKCHAIN]: [
    WorkflowState.ANCHORED,
    WorkflowState.FAILED,
  ],
  [WorkflowState.ANCHORED]: [],
  [WorkflowState.FAILED]: [],
  [WorkflowState.REJECTED]: [],
};
