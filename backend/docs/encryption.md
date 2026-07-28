# SMALDA Encryption Documentation

## Overview

SMALDA encrypts sensitive land document data both in transit and at rest. This document describes the encryption architecture and operational procedures.

## In-Transit Encryption

All client-server communication uses TLS 1.3. The backend enforces HTTPS in production via the `FORCE_HTTPS` environment variable. API responses include `Strict-Transport-Security` headers.

### JWT Tokens

- Access tokens are signed with HMAC-SHA256 using a secret of at least 32 characters.
- Refresh tokens use a separate secret (`JWT_REFRESH_SECRET`) or fall back to `JWT_SECRET`.
- Token expiry defaults to 1 hour for access tokens and 7 days for refresh tokens.

## At-Rest Encryption

### Document Storage

- Uploaded documents are stored on disk under `UPLOAD_DIR`.
- File content is hashed using SHA-256 before storage.
- The hash is anchored on the Stellar blockchain for tamper-proof verification.
- Document files themselves are not encrypted at rest in the current version; file system-level encryption (e.g., LUKS, dm-crypt, or cloud-provider encryption) is recommended for production deployments.

### Database

- PostgreSQL stores document metadata and user data.
- Enable PostgreSQL Transparent Data Encryption (TDE) or disk-level encryption in production.
- Sensitive fields (e.g., `twoFactorSecret`, `twoFactorBackupCodes`) are stored as hashed values.

### Passwords

- Passwords are hashed using bcrypt with a cost factor of 12.
- Backup codes for two-factor authentication are stored hashed.

## Stellar Blockchain Anchoring

- Document file hashes (SHA-256) are anchored on Stellar testnet or public network.
- The anchoring transaction hash and ledger number are stored alongside the document record.
- The Stellar SDK client verifies network connectivity at startup.

## Key Management

| Key/Secret | Location | Rotation |
|---|---|---|
| `JWT_SECRET` | Environment variable | Rotate quarterly |
| `JWT_REFRESH_SECRET` | Environment variable | Rotate quarterly |
| `STELLAR_SECRET` | Environment variable | Rotate on compromise |
| Database password | Environment variable | Rotate on compromise |
| File system encryption | Infrastructure | Per policy |

## Environment Variables for Encryption

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Min 32 chars. Signs JWT access tokens. |
| `JWT_REFRESH_SECRET` | No | Signs refresh tokens. Falls back to `JWT_SECRET`. |
| `JWT_EXPIRATION` | No | Token lifetime. Default: `1h`. |
| `STELLAR_SECRET` | Yes | Stellar secret key for anchoring transactions. |
| `STELLAR_NETWORK` | Yes | `testnet` or `public`. |
| `FORCE_HTTPS` | No | Redirect HTTP to HTTPS in production. |
| `CORS_ORIGIN` | No | Comma-separated allowed origins. |
| `COOKIE_SECRET` | No | Signed cookie secret for session middleware. |

## Operational Security

### Before Deploying

1. Rotate all secrets from development defaults.
2. Ensure `JWT_SECRET` is at least 32 characters.
3. Set `STELLAR_NETWORK=public` in production.
4. Enable disk-level or database-level encryption.
5. Verify HTTPS is enforced.
6. Review `CORS_ORIGIN` for production domains.

### Incident Response

If a secret is compromised:
1. Rotate the secret immediately.
2. Invalidate all active JWTs by changing `JWT_SECRET`.
3. Review access logs for unauthorized access patterns.
4. Check Stellar blockchain for unauthorized anchoring transactions.
