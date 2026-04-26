import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RiskFlagChart, { getBarWidth } from "./index";

describe("getBarWidth", () => {
  it("returns 0% when total is zero", () => {
    expect(getBarWidth(10, 0)).toBe("0%");
  });

  it("returns 0% when weight is zero", () => {
    expect(getBarWidth(0, 50)).toBe("0%");
  });

  it("calculates width relative to total score", () => {
    expect(getBarWidth(25, 100)).toBe("25%");
    expect(getBarWidth(33, 100)).toBe("33%");
    expect(getBarWidth(67, 100)).toBe("67%");
  });
});

describe("RiskFlagChart", () => {
  it("renders a message when no flags are detected", () => {
    render(<RiskFlagChart flags={[]} />);
    expect(screen.getByText("No risk flags detected.")).toBeInTheDocument();
  });

  it("renders each detected flag with name, points, and bar", () => {
    render(
      <RiskFlagChart
        flags={[
          { id: "1", name: "High Severity", weight: 40 },
          { id: "2", name: "Minor Issue", weight: 10 },
        ]}
      />
    );

    expect(screen.getByText("High Severity")).toBeInTheDocument();
    expect(screen.getByText("40 pts")).toBeInTheDocument();
    expect(screen.getByText("Minor Issue")).toBeInTheDocument();
    expect(screen.getByText("10 pts")).toBeInTheDocument();

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-label", "High Severity contributes 80% of total risk");
    expect(bars[1]).toHaveAttribute("aria-label", "Minor Issue contributes 20% of total risk");
  });
});
