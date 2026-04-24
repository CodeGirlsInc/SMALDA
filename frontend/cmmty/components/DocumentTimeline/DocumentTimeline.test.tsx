import { DocumentTimeline } from "./DocumentTimeline";
import { TimelineEvent } from "./types";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { formatRelativeTime } from "../../lib/time";

describe("DocumentTimeline", () => {
  const mockEvents: TimelineEvent[] = [
    {
      id: "1",
      type: "uploaded",
      title: "Document Uploaded",
      description: "Initial file upload",
      timestamp: "2026-04-24T10:00:00Z",
    },
    {
      id: "2",
      type: "risk_analysis_started",
      title: "Risk Analysis Started",
      description: "Automated scanning beginning",
      timestamp: "2026-04-24T11:00:00Z",
    },
  ];

  it("renders all events", () => {
    render(<DocumentTimeline events={mockEvents} />);
    expect(screen.getByText("Document Uploaded")).toBeInTheDocument();
    expect(screen.getByText("Risk Analysis Started")).toBeInTheDocument();
  });

  it("sorts events by timestamp descending", () => {
    render(<DocumentTimeline events={mockEvents} />);
    const titles = screen.getAllByRole("heading", { level: 4 });
    expect(titles[0]).toHaveTextContent("Risk Analysis Started");
    expect(titles[1]).toHaveTextContent("Document Uploaded");
  });

  it("shows relative timestamps", () => {
    render(<DocumentTimeline events={mockEvents} />);
    const relativeTime = formatRelativeTime(mockEvents[0].timestamp);
    expect(screen.getByText(relativeTime)).toBeInTheDocument();
  });

  it("shows full date on hover (title attribute)", () => {
    render(<DocumentTimeline events={mockEvents} />);
    const timestampElement = screen.getByText(formatRelativeTime(mockEvents[0].timestamp));
    expect(timestampElement).toHaveAttribute("title");
    expect(timestampElement.getAttribute("title")).toContain("April 24, 2026");
  });
});
