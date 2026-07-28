# SMALDA Backend Architecture

## Overview

SMALDA is a NestJS 11 application backed by PostgreSQL, Redis (BullMQ), and Stellar blockchain. The backend handles document upload, risk assessment, external validation, Stellar anchoring, and verification.

## Document Lifecycle

```
Upload → Risk Assessment → Queue → External Validation → Stellar Anchoring → Verification
```

1. **Upload** — User uploads a PDF/image via `POST /api/v1/documents/upload`. File is saved to disk, SHA-256 hash computed, document record created with `PENDING` status.
2. **Risk Assessment** — BullMQ worker picks up the job, calls `RiskAssessmentService.assessDocument()`. Score and flags are stored on the document.
3. **External Validation** — If risk is acceptable, the document is validated against land registry, government ID, or business registration providers.
4. **Stellar Anchoring** — File hash is anchored on Stellar testnet/public via `StellarService.anchorHash()`.
5. **Verification** — A `VerificationRecord` is created linking the document to its Stellar transaction hash and ledger number. Document status becomes `VERIFIED`.

## Module Map

| Module | Responsibility | Dependencies |
|---|---|---|
| **AuthModule** | JWT authentication, OAuth (Google, GitHub), registration, login, refresh tokens | UsersModule, JwtModule, PassportModule |
| **UsersModule** | User CRUD, profile management | TypeORM (User entity) |
| **DocumentsModule** | Document upload, retrieval, status management | TypeORM (Document entity), QueueModule, StellarModule, VerificationModule |
| **RiskAssessmentModule** | Automated document risk scoring | DocumentsModule |
| **QueueModule** | BullMQ job processing (analyze, anchor) | DocumentsModule, RiskAssessmentModule, StellarModule, VerificationModule |
| **VerificationModule** | Stellar blockchain verification records | TypeORM (VerificationRecord entity) |
| **StellarModule** | Stellar SDK integration, hash anchoring | ConfigModule |
| **ExternalValidationModule** | Land registry, government ID, business registration checks | ConfigModule, Axios |
| **DisputeModule** | Dispute filing and resolution | TypeORM |
| **AccessLogsModule** | Document access audit trail | TypeORM (AccessLog entity) |
| **MailModule** | Email sending via nodemailer | ConfigModule |
| **TwoFactorModule** | TOTP-based 2FA with speakeasy | UsersModule |

## Data Model

### Core Entities

- **User** — id, email, passwordHash, fullName, role (admin/user), isVerified, twoFactorEnabled
- **Document** — id, ownerId (FK→User), title, filePath, fileHash (unique), fileSize, mimeType, status, riskScore, riskFlags, archived
- **VerificationRecord** — id, documentId, stellarTxHash, stellarLedger, anchoredAt, status
- **AccessLog** — id, userId, documentId, routePath, httpMethod, ipAddress, statusCode, createdAt
- **Dispute** — id, documentId, reason, status, resolution

### Relationships

- User 1:N Document (owner)
- Document 1:N VerificationRecord
- Document 1:N AccessLog

## API Versioning

All endpoints are versioned via URI: `/api/v1/...`

The default version is `1`. A deprecation policy is documented below.

## Environment Variables

See `src/config/config.validation.ts` for the full list. Key variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Environment mode |
| `DATABASE_HOST` | Yes | — | PostgreSQL host |
| `DATABASE_PORT` | No | `5432` | PostgreSQL port |
| `DATABASE_USER` | Yes | — | PostgreSQL user |
| `DATABASE_PASSWORD` | Yes | — | PostgreSQL password |
| `DATABASE_NAME` | Yes | — | PostgreSQL database |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `JWT_SECRET` | Yes | — | Min 32 chars. Signs JWT tokens. |
| `STELLAR_NETWORK` | Yes | `testnet` | `testnet` or `public` |
| `STELLAR_HORIZON_URL` | Yes | — | Stellar Horizon API URL |
| `UPLOAD_DIR` | No | `./uploads` | Document upload directory |
| `APP_PORT` | No | `6004` | Server port |
| `LOG_LEVEL` | No | `debug`/`warn` | Winston log level |

## Local Development

```bash
# 1. Start services
docker compose up -d

# 2. Install dependencies
cd backend && npm install

# 3. Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Start development server
npm run start:dev
```

The API will be available at `http://localhost:6004/api/v1/`.
Swagger docs at `http://localhost:6004/api/docs`.

## Testing

```bash
npm test          # Unit tests
npm run test:cov  # Coverage
npm run test:e2e  # E2E tests
```

Module PRs should include tests for new functionality.

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- NestJS conventions: modules, controllers, services, DTOs
- Use `class-validator` and `class-transformer` for DTO validation
- Use `@Exclude()` from `class-transformer` for sensitive entity fields
- Global `ClassSerializerInterceptor` strips excluded fields from responses

## PR Process

1. Create a feature branch from `main`
2. Implement changes with tests
3. Run `npm run lint`, `npm run build`, `npm test`
4. Open a PR with a clear description
5. Reference the issue number in the commit body (`Closes #N`)
6. One PR per contributor per repository

## API Versioning and Deprecation Policy

- **Versioning**: URI-based (`/api/v1/`, `/api/v2/`).
- **New versions**: Released when breaking changes are unavoidable.
- **Deprecation notice**: Minimum 6 months before removing a version.
- **Current version**: v1
- **Public endpoints**: The verification endpoint (`/api/v1/verification/:id`) is linked externally and its URL stability is prioritized.
