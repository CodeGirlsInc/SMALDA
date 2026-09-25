import React from "react";
import { render, screen } from "@testing-library/react";
import { RiskGauge } from "../RiskGauge";

describe("RiskGauge", () => {
  it("renders the numeric score", () => {
    render(<RiskGauge riskScore={85} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("includes a text-equivalent of the score for screen readers", () => {
    render(<RiskGauge riskScore={85} />);
    expect(screen.getAllByText(/High risk/).length).toBeGreaterThan(0);
    expect(screen.getByText(/85 out of 100/)).toBeInTheDocument();
  });

  it("renders a flag-by-flag breakdown beneath the gauge", () => {
    render(
      <RiskGauge
        riskScore={60}
        riskFlags={["Ownership conflict", "Duplicate title"]}
      />
    );
    expect(screen.getByText("Ownership conflict")).toBeInTheDocument();
    expect(screen.getByText("Duplicate title")).toBeInTheDocument();
  });

  it("renders no flag list when there are no flags", () => {
    render(<RiskGauge riskScore={10} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("clamps out-of-range scores", () => {
    render(<RiskGauge riskScore={150} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("labels low scores as low risk", () => {
    render(<RiskGauge riskScore={15} />);
    expect(screen.getAllByText(/Low risk/).length).toBeGreaterThan(0);
  });

  it("uses theme-aware colors for the gauge and flags", () => {
    const { container } = render(
      <RiskGauge riskScore={85} riskFlags={["Ownership conflict"]} />,
    );
    const [track, indicator] = container.querySelectorAll("circle");
    const flag = screen.getByText("Ownership conflict");

    expect(track).toHaveAttribute("stroke", "var(--muted)");
    expect(indicator).toHaveAttribute("stroke", "var(--risk-high)");
    expect(screen.getByRole("status")).toHaveStyle("color: var(--risk-high)");
    expect(screen.getByText("85")).toHaveClass("text-foreground");
    expect(screen.getByText("/ 100")).toHaveClass("text-muted-foreground");
    expect(flag).toHaveClass("text-muted-foreground");
    expect(flag.querySelector("span")).toHaveClass("bg-risk-medium");
  });
});
