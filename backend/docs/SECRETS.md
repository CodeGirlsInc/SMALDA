# Secrets Management & Rotation Procedure

## 1. Inventory

The backend requires the secrets below. No secret is committed to the repository (see `.gitignore` and `config/config.validation.ts`).

| Secret | Purpose | Blast radius if leaked |
|--------|---------|------------------------|
| `JWT_SECRET` | Signs access tokens | Attacker can forge tokens for any user and access the API as them. |
| `JWT_REFRESH_SECRET` | Signs refresh tokens | Attacker can obtain perpetual access and rotate compromised sessions. |
| `DATABASE_PASSWORD` | PostgreSQL authentication | Full read/write access to land records, users, hashes, and audit logs. |
| `REDIS_PASSWORD` | Redis/BullMQ authentication | Queue tampering, job injection, or denial of service for async processing. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client | OAuth token theft, account takeover via Google login. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth 2.0 client | OAuth token theft, account takeover via GitHub login. |
| `MAIL_PASSWORD` / `SMTP_PASS` | SMTP authentication | Email spoofing, password-reset interception, notification abuse. |
| `STELLAR_SECRET_KEY` | Signs Stellar transactions | Theft or misuse of funds; unauthorized anchor transactions. |
| `ENCRYPTION_SECRET` (optional) | `crypto.util.ts` symmetric key | Decryption of any buffer encrypted with the utility. |

## 2. Storage

| Environment | Storage | Notes |
|-------------|---------|-------|
| Local development | `backend/.env` (git-ignored) | Use the example file and random placeholders. Rotate if a developer leaves or shares their machine. |
| Staging / Production | Platform secret manager (e.g. Vercel/Render/Doppler secrets or AWS Secrets Manager) | Mount secrets as environment variables. Never print them in build logs or crash reports. |
| CI / CD | Provider secret store (GitHub Actions secrets, GitLab CI variables) | Mark variables as masked/secret. Use separate values per environment. |

## 3. Rotation runbooks

### 3.1 JWT signing secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)

**Goal:** Rotate keys without immediately invalidating all live sessions.

The backend currently validates tokens against a single secret. To support rotation with a grace period, maintain a list of active secrets and validate against all of them while only signing new tokens with the newest key.

Proposed implementation:
1. Add `JWT_SECRET` and `JWT_REFRESH_SECRET` as comma-separated key lists (`current,previous`).
2. Use the first value to sign new tokens.
3. Accept tokens signed by any value in the list during validation.
4. Update `JwtStrategy` and `AuthService.refreshToken` to try each key.
5. After the access-token TTL (`JWT_EXPIRATION`) plus a safety margin, remove the old key from the list.

Runbook:
1. Generate new secrets (min 32 bytes, cryptographically random).
2. Prepend them to the active key lists in the secret manager: `new_secret,old_secret`.
3. Redeploy the backend.
4. Verify new logins succeed and old tokens still work.
5. Wait at least `JWT_EXPIRATION` + `JWT_REFRESH_EXPIRATION`.
6. Remove the old secrets from the lists.
7. Redeploy again.

### 3.2 Database password (`DATABASE_PASSWORD`)

1. Create a new PostgreSQL user/role with the same privileges.
2. Update the secret manager with the new password.
3. Redeploy the backend; the old pool connections remain valid briefly.
4. Revoke the old user or change the old user's password.
5. Monitor logs for connection failures.

### 3.3 Redis password (`REDIS_PASSWORD`)

1. Set a new Redis ACL password or rotate AUTH password.
2. Update the secret manager.
3. Redeploy; BullMQ workers reconnect with the new password.
4. Remove the old password from Redis.

### 3.4 OAuth client secrets (`GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`)

1. In the provider console, generate a new client secret.
2. Update the backend secret manager.
3. Redeploy.
4. Revoke the old secret in the provider console after confirming OAuth login still works.

### 3.5 Mail credentials (`MAIL_PASSWORD`, `SMTP_PASS`)

1. Generate a new app password in the mail provider.
2. Update `MAIL_PASSWORD`, `MAIL_USER`, and mirrored `SMTP_*` values.
3. Redeploy.
4. Send a test email and verify mail delivery.
5. Revoke the old app password.

### 3.6 Stellar secret key (`STELLAR_SECRET_KEY`)

1. Create a new Stellar keypair.
2. Fund or authorize the new account for anchoring.
3. Update the secret manager.
4. Redeploy and submit one test anchor transaction.
5. Transfer any remaining funds and disable the old account if possible.

## 4. Rotation cadence

| Secret | Recommended cadence |
|--------|---------------------|
| JWT secrets | Every 90 days or on employee/offboarding events. |
| Database password | Every 180 days or on suspected exposure. |
| Redis password | Every 180 days or on suspected exposure. |
| OAuth client secrets | Every 180 days or after provider breach notification. |
| Mail credentials | Every 90 days. |
| Stellar secret key | Every 180 days or after any on-chain suspicious activity. |

## 5. Incident procedure for suspected exposure

1. **Contain:** Immediately rotate the exposed secret.
2. **Verify:** Search logs for unauthorized use (correlation IDs help here).
3. **Notify:** Alert the team and, if user data is at risk, follow the incident response plan.
4. **Review:** Check how the secret was exposed and update storage/processes.
5. **Document:** Record the incident, timeline, and remediation.

## 6. Development credentials

Contributors must never use production values. Use one of these options:

1. Copy `backend/.env.example` to `backend/.env` and replace placeholders with local-only values.
2. Use the project's secret manager development sandbox if available.
3. Generate local OAuth apps in Google/GitHub with `localhost` callback URLs.
4. Use a local Stellar testnet account for `STELLAR_SECRET_KEY`.

Run `npm run test` after setting local values to confirm the validation schema passes.
