import { ReactNode } from "react";

export type EventType =
  | "uploaded"
  | "risk_analysis_started"
  | "risk_analysis_completed"
  | "verification_requested"
  | "verified_on_stellar";

export interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  timestamp: string;
  icon?: ReactNode;
}

export interface DocumentTimelineProps {
  events: TimelineEvent[];
  className?: string;
}
