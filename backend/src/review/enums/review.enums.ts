export enum ReviewStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  ESCALATED = "escalated",
  CANCELLED = "cancelled",
}

export enum ReviewDecision {
  APPROVE = "approve",
  REJECT = "reject",
  OVERRIDE_APPROVE = "override_approve",
  OVERRIDE_REJECT = "override_reject",
  ESCALATE = "escalate",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum CommentType {
  GENERAL = "general",
  RISK_ASSESSMENT = "risk_assessment",
  APPROVAL_REASON = "approval_reason",
  REJECTION_REASON = "rejection_reason",
  ESCALATION = "escalation",
}
