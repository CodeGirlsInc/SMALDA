/**
 * jsdom test environment extended with the web APIs jsdom omits.
 *
 * msw v2 (via @mswjs/interceptors) needs the Fetch API and web streams at
 * import time, and jest-environment-jsdom provides neither. Node 18+ ships
 * native implementations, so copy them into the jsdom sandbox rather than
 * pulling in undici as an extra dependency.
 */
const JSDOMEnvironmentModule = require("jest-environment-jsdom");

const JSDOMEnvironment =
  JSDOMEnvironmentModule.default ||
  JSDOMEnvironmentModule.TestEnvironment ||
  JSDOMEnvironmentModule;

const WEB_GLOBALS = [
  "fetch",
  "Request",
  "Response",
  "Headers",
  "FormData",
  "Blob",
  "File",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
  "TextEncoder",
  "TextDecoder",
  "structuredClone",
  "BroadcastChannel",
  "MessageChannel",
  "MessagePort",
];

class JSDOMWithWebApis extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    for (const name of WEB_GLOBALS) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
  }
}

module.exports = JSDOMWithWebApis;
