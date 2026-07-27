import "@testing-library/jest-dom";

// Silence next-intl warnings in test output
beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
