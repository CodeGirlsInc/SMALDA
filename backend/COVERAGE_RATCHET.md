# Test Coverage Ratchet Policy

## Overview
This project enforces a **coverage ratchet policy** for test coverage, meaning that test coverage thresholds can only increase over time, never decrease. This ensures that our codebase's test quality continuously improves rather than degrades.

## Current Coverage Thresholds (Last Updated: 2026-07-28)

### Global Thresholds
All modules combined must meet these minimums:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Per-Module Thresholds
Each module has its own coverage requirements:

| Module | Current Threshold | Notes |
|--------|-------------------|-------|
| documents/ | 80% for all metrics | Has existing test suite |
| All other modules | 0% for all metrics | Placeholders - will be increased as tests are added |

## How to Update Thresholds
When you add tests to a module and improve its coverage:

1. **Check current coverage**: Run `npm run test:cov` to see the current coverage numbers
2. **Update thresholds**: In `package.json` under `jest.coverageThreshold`, increase the thresholds for the module you've improved
3. **Verify CI passes**: The CI will fail if the new thresholds aren't met
4. **Commit the changes**: The updated thresholds must be committed with the tests that enable them

## CI Enforcement
- The CI pipeline runs `npm run test:cov` on every PR and push to main
- If coverage drops below any threshold, the build fails
- Coverage reports are uploaded as artifacts for inspection
- A module with no tests will fail its per-module threshold once it's set above 0%

## Why This Policy Exists
- Prevents "coverage rot" where tests are removed or become outdated without replacement
- Encourages developers to add tests for new code
- Ensures that as the codebase grows, test quality doesn't suffer
- Makes technical debt around testing visible and actionable

## Adding New Modules
When adding a new module to the codebase:
1. Add an entry in `jest.coverageThreshold` with 0% thresholds initially
2. Create a GitHub issue to track adding tests for the new module
3. Once tests are written and coverage is established, increase the thresholds