// Polyfill crypto.randomUUID for jsdom environment
if (typeof crypto !== "undefined" && !crypto.randomUUID) {
  let counter = 0;
  Object.defineProperty(crypto, "randomUUID", {
    value: () => `mock-uuid-${++counter}-${Date.now()}`,
    writable: true,
    configurable: true,
  });
}
