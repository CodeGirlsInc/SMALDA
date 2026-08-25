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
});
