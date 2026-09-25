const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  // jsdom plus the Fetch API and web streams that msw v2 needs. See the file
  // for details.
  testEnvironment: "./test-utils/jsdom-with-web-apis.js",
  // msw v2 ships `msw/node` behind the "node" export condition. jest-environment-jsdom
  // requests the "browser" condition, so without this the import fails to resolve.
  // Clearing the list lets Jest fall back to the package's default export.
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
  setupFilesAfterEnv: ["@testing-library/jest-dom", "./test-utils/test-setup.ts"],
  testMatch: [
    "**/app/**/*.{test,spec}.{ts,tsx}",
    "**/test-utils/**/*.test.{ts,tsx}",
    "**/components/**/*.test.{ts,tsx}",
    "**/lib/**/*.test.{ts,tsx}",
    "**/i18n/**/*.test.{ts,tsx}",
    "**/__tests__/**/*.{test,spec}.{ts,tsx}",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "lib/**/*.{js,jsx,ts,tsx}",
    "i18n/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/*.test.{js,jsx,ts,tsx}",
    "!**/*.spec.{js,jsx,ts,tsx}",
    "!app/**/layout.{js,jsx,ts,tsx}",
    "!app/**/loading.{js,jsx,ts,tsx}",
    "!app/**/error.{js,jsx,ts,tsx}",
    "!app/**/not-found.{js,jsx,ts,tsx}",
    "!app/**/route.{js,jsx,ts,tsx}",
    "!app/**/template.{js,jsx,ts,tsx}",
    "!app/**/default.{js,jsx,ts,tsx}",
    "!app/**/middleware.{js,jsx,ts,tsx}",
    "!app/sitemap.{js,ts}",
    "!app/robots.{js,ts}",
    "!**/node_modules/**",
    "!**/.next/**",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/\\.next/",
    "/coverage/",
    "/e2e/",
    "/test-utils/",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1,
    },
  },
};

// next/jest sets a blanket `/node_modules/` transformIgnorePattern, which stops
// next-intl (shipped as ES modules) from being transformed. Override the
// generated config so those packages are transpiled for Jest.
module.exports = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    testEnvironmentOptions: {
      ...jestConfig.testEnvironmentOptions,
      customExportConditions: ["node", "node-addons"],
    },
    transformIgnorePatterns: [
      // next-intl and msw both reach ESM-only packages that Jest must transpile.
      "/node_modules/(?!(?:\\.pnpm/)?(?:next-intl|use-intl|intl-messageformat|@formatjs|msw|@mswjs|@open-draft|rettime|until-async|strict-event-emitter|outvariant|headers-polyfill)/)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
};
