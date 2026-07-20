const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["@testing-library/jest-dom", "./cmmty/test-setup.ts"],
  testMatch: ["**/cmmty/**/*.test.{ts,tsx}"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

// next/jest sets a blanket `/node_modules/` transformIgnorePattern, which stops
// next-intl (shipped as ES modules) from being transformed. Override the
// generated config so those packages are transpiled for Jest.
module.exports = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    transformIgnorePatterns: [
      "/node_modules/(?!(?:\\.pnpm/)?(?:next-intl|use-intl|intl-messageformat|@formatjs)/)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
};
