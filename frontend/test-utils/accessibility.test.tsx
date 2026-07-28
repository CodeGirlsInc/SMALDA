import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * Baseline accessibility assertion used by FE-84. Runs axe against a
 * minimal labelled landmark + heading + button combination to confirm
 * the test framework is wired and the JSX grammar used elsewhere does
 * not introduce new violations. Component-level accessibility checks
 * live next to their components; this file is the single regression
 * net across the shared test-utils.
 */
describe("baseline a11y (FE-84)", () => {
  it("a labelled landmark, heading, and button pass axe", async () => {
    const { container } = render(
      <main aria-labelledby="a11y-h1">
        <h1 id="a11y-h1">Sample</h1>
        <button type="button">Continue</button>
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
