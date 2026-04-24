"use client";

import React from "react";
import { 
  Upload, 
  Search, 
  CheckCircle2, 
  FileCheck, 
  Zap 
} from "lucide-react";
import { formatRelativeTime, formatFullDateTime } from "../../lib/time";
import { DocumentTimelineProps, TimelineEvent, EventType } from "./types";
import "./DocumentTimeline.css";

const getIcon = (type: EventType) => {
  switch (type) {
    case "uploaded":
      return <Upload size={18} />;
    case "risk_analysis_started":
      return <Search size={18} />;
    case "risk_analysis_completed":
      return <CheckCircle2 size={18} />;
    case "verification_requested":
      return <FileCheck size={18} />;
    case "verified_on_stellar":
      return <Zap size={18} />;
    default:
      return <Upload size={18} />;
  }
};

export const DocumentTimeline: React.FC<DocumentTimelineProps> = ({ 
  events, 
  className = "" 
}) => {
  // Sort events by timestamp descending (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className={`timeline-container ${className}`}>
      <div className="timeline-line"></div>
      <div className="timeline-events">
        {sortedEvents.map((event, index) => (
          <div 
            key={event.id} 
            className={`timeline-event ${event.type}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="timeline-icon-wrapper">
              {event.icon || getIcon(event.type)}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <h4 className="timeline-title">{event.title}</h4>
                <span 
                  className="timeline-timestamp" 
                  title={formatFullDateTime(event.timestamp)}
                >
                  {formatRelativeTime(event.timestamp)}
                </span>
              </div>
              <p className="timeline-description">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
