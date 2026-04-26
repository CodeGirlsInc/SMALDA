import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RiskGauge, { getRiskLevel } from "./index";

describe("getRiskLevel", () => {
  it.each([
    [0, "Low Risk"],
    [15, "Low Risk"],
    [29, "Low Risk"],
    [30, "Medium Risk"],
    [45, "Medium Risk"],
    [59, "Medium Risk"],
    [60, "High Risk"],
    [80, "High Risk"],
    [100, "High Risk"],
  ])("score %i → %s", (score, expected) => {
    expect(getRiskLevel(score)).toBe(expected);
  });
});

describe("RiskGauge", () => {
  it("renders the score", () => {
    render(<RiskGauge score={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders Low Risk label for score 20", () => {
    render(<RiskGauge score={20} />);
    expect(screen.getByText("Low Risk")).toBeInTheDocument();
  });

  it("renders Medium Risk label for score 45", () => {
    render(<RiskGauge score={45} />);
    expect(screen.getByText("Medium Risk")).toBeInTheDocument();
  });

  it("renders High Risk label for score 75", () => {
    render(<RiskGauge score={75} />);
    expect(screen.getByText("High Risk")).toBeInTheDocument();
  });

  it("has accessible aria-label", () => {
    render(<RiskGauge score={60} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Risk gauge: 60 - High Risk");
  });
});
