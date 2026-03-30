# Security Features Implementation

This document describes the security enhancements implemented in the SMALDA backend.

## 1. Password Reset Flow

### Endpoints
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

### Features
- Short-lived JWT reset tokens (1 hour expiry)
- Email sent via MailService with reset link
- Token invalidated after single use
- Same success message whether email exists or not (prevents enumeration)
- All refresh tokens revoked after password reset

### Usage
```bash
# Request reset
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "reset-token", "password": "newpassword123"}'
```

## 2. Email Verification

### Endpoints
- `GET /api/auth/verify-email?token=...` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email (rate-limited)

### Features
- Verification email sent on registration with signed JWT token (24h expiry)
- GET endpoint validates token and sets `isVerified: true`
- Unverified users blocked from uploading documents (403 Forbidden)
- Rate-limited resend endpoint (3 requests per minute)

### Usage
```bash
# Verify email
curl "http://localhost:3001/api/auth/verify-email?token=verification-token"

# Resend verification (requires auth)
curl -X POST http://localhost:3001/api/auth/resend-verification \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 3. Refresh Token Rotation

### Endpoints
- `POST /api/auth/refresh` - Refresh access token with rotation
- `POST /api/auth/logout` - Revoke refresh tokens

### Features
- Refresh tokens stored in database with hash
- Token rotation on every refresh (old token revoked, new one issued)
- Detection of rotation violations (reused tokens revoke all sessions)
- Logout endpoint revokes current or all refresh tokens
- Optional mass logout via `revokeAll` flag

### Database Schema
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Usage
```bash
# Refresh token (rotation)
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "current-refresh-token"}'

# Logout single session
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "current-refresh-token"}'

# Logout all sessions
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"revokeAll": true}'
```

## 4. Two-Factor Authentication (2FA)

### Endpoints
- `POST /api/auth/2fa/generate` - Generate TOTP secret and QR code URI
- `POST /api/auth/2fa/enable` - Enable 2FA with TOTP code
- `POST /api/auth/2fa/disable` - Disable 2FA with TOTP code
- `POST /api/auth/2fa/verify` - Verify 2FA code during login

### Features
- TOTP-based 2FA using otplib library
- Secret stored encrypted in database (base64 placeholder, should use AES-256-GCM)
- Login flow returns `requires2FA: true` flag when 2FA enabled
- Second step required to complete login with TOTP code

### User Entity Changes
```typescript
@Column({ name: 'two_factor_secret', nullable: true })
twoFactorSecret?: string | null;

@Column({ name: 'is_two_factor_enabled', default: false })
isTwoFactorEnabled: boolean;
```

### Usage
```bash
# Generate 2FA secret (requires auth)
curl -X POST http://localhost:3001/api/auth/2fa/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response: {"secret": "...", "otpauthUrl": "otpauth://totp/..."}

# Enable 2FA (scan QR code first, then submit code)
curl -X POST http://localhost:3001/api/auth/2fa/enable \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'

# Login with 2FA
# Step 1: Normal login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Response if 2FA enabled: {"requires2FA": true, "userId": "..."}

# Step 2: Submit 2FA code
curl -X POST http://localhost:3001/api/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"userId": "...", "code": "123456"}'

# Disable 2FA (requires auth + current TOTP code)
curl -X POST http://localhost:3001/api/auth/2fa/disable \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

## Database Migration

Run the migration to apply all schema changes:

```bash
cd backend
npm run migration:run
```

Migration includes:
- Adding `two_factor_secret` and `is_two_factor_enabled` columns to `users` table
- Creating `refresh_tokens` table with proper indexes and foreign keys

## Security Considerations

### Production Recommendations

1. **Encryption**: Replace base64 encoding with proper AES-256-GCM encryption for 2FA secrets
2. **Rate Limiting**: Already implemented on sensitive endpoints (forgot-password, resend-verification)
3. **HTTPS**: Always use HTTPS in production
4. **Token Expiry**: Adjust token expiry times based on security requirements
5. **Audit Logging**: Log all authentication events for security monitoring
6. **Backup Codes**: Consider implementing backup codes for 2FA recovery

### Token Security

- Reset tokens: 1 hour expiry, single use
- Verification tokens: 24 hour expiry
- Access tokens: Short-lived (default JWT expiry)
- Refresh tokens: 7 day expiry, stored with hash, rotation enforced

## Testing

All endpoints are documented with Swagger/OpenAPI specs. Access the API docs at:
```
http://localhost:3001/api/docs
```

## Dependencies Added

- `otplib` - TOTP/HOTP authentication
- `@types/otplib` - TypeScript definitions

## Files Modified/Created

### Created:
- DTOs: `forgot-password.dto.ts`, `reset-password.dto.ts`, `verify-email.dto.ts`, `two-factor.dto.ts`
- Entity: `refresh-token.entity.ts`
- Guard: `verified-user.guard.ts`
- Migration: `004_AddSecurityFeatures.ts`

### Modified:
- `user.entity.ts` - Added 2FA fields
- `auth.service.ts` - Added all authentication methods
- `auth.controller.ts` - Added all endpoints
- `auth.module.ts` - Added MailModule and TypeORM feature
- `users.service.ts` - Added refresh token management
- `users.module.ts` - Added RefreshToken entity
- `mail.service.ts` - Added verification and reset emails
- `documents.controller.ts` - Changed to VerifiedUserGuard for uploads
