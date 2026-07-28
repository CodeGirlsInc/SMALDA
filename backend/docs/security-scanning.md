# Security Scanning Documentation

## Overview

SMALDA runs automated security scans in CI to catch known vulnerabilities and misconfigurations before they reach production.

## Scanning Tools

### Backend (npm audit)

`npm audit` is run in CI with `--audit-level=moderate` to catch known vulnerabilities in Node.js dependencies.

### Frontend (npm audit)

`npm audit` is run in CI with `--audit-level=moderate` to catch known vulnerabilities in Next.js dependencies.

### Rust Contract (cargo audit)

`cargo audit --deny warnings` scans the Stellar smart contract for known vulnerabilities in Rust crate dependencies. This job runs on a nightly schedule and on every PR.

### Docker Image Scanning

The production Dockerfile uses a minimal `node:20-alpine` base image. For additional scanning:
- Use `trivy` or `grype` to scan the built Docker image.
- Example: `trivy image smalda-backend:latest`

### Static Application Security Testing (SAST)

- ESLint with `@typescript-eslint` rules catches common security anti-patterns.
- The `no-eval` and `no-implied-eval` rules are enabled.
- The `@typescript-eslint/no-floating-promises` rule ensures promise rejections are handled.

## CI/CD Security Pipeline

The CI pipeline (`.github/workflows/ci.yml`) includes:

1. **Lint** — ESLint for code quality and security anti-patterns.
2. **Unit Tests** — Jest test suite.
3. **Build** — TypeScript compilation.
4. **npm audit** — Known vulnerability scanning for npm packages.
5. **cargo audit** — Known vulnerability scanning for Rust crates.

## Running Locally

### npm audit (backend/frontend)

```bash
cd backend && npm audit --audit-level=moderate
cd frontend && npm audit --audit-level=moderate
```

### cargo audit (contract)

```bash
cd contract
cargo install cargo-audit
cargo audit --deny warnings
```

### ESLint security checks

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

## Vulnerability Reporting

If you discover a security vulnerability in SMALDA:

1. **Do not** open a public GitHub issue.
2. Email the maintainers or use the private vulnerability reporting feature.
3. Include the vulnerability description, affected version, and reproduction steps.
4. Allow 72 hours for an initial response.

## Security Headers

The backend should set the following headers in production:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Per-page policy |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

## Dependency Update Policy

- Run `npm audit` weekly.
- Run `cargo audit` weekly.
- Review and merge Dependabot PRs within 7 days for moderate+ vulnerabilities.
- Critical vulnerabilities should be patched within 24 hours.
