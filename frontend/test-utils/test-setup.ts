// Global test setup.
// MSW server is NOT started here because msw v2 ships ESM dependencies
// that are not compatible with Jest's CJS transform pipeline in jsdom.
// Tests that need HTTP mocking should mock `globalThis.fetch` directly.
