# Deployment Guide

## Environments

| Environment | Purpose | Access | Stellar Network | Database |
|---|---|---|---|---|
| **Development** | Local development | Team members | Testnet | Local Postgres |
| **Staging** | Pre-production testing | QA + devs | Testnet | Staging Postgres |
| **Production** | Live platform | Public | Mainnet (when ready) | Production Postgres |

> **Important**: Non-production environments must never point at Stellar mainnet.

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (recommended)

## Local Development

```bash
# Clone and configure
git clone https://github.com/CodeGirlsInc/SMALDA.git
cp .env.example .env
# Edit .env with your local settings

# Start infrastructure
docker compose up -d postgres redis

# Backend
cd backend && npm install && npm run migration:run && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev
```

## Deployment Process

### Development
- Push to feature branch → open PR → merge to main
- CI runs automatically on all PRs

### Staging
1. Merge to `main` triggers automatic deployment
2. Run migrations: `npm run migration:run`
3. Verify health endpoint: `GET /api/health`

### Production
1. Create a release tag: `git tag v1.x.x`
2. Deploy the tagged commit
3. Run migrations before serving traffic
4. Verify health and monitoring

## Rollback Procedure

### Before migration revert
1. Redeploy the previous version
2. No data migration needed

### After migration has run
1. Run the TypeORM revert: `npm run migration:revert`
2. Redeploy the previous version
3. Verify data integrity

## Pre-deploy Checklist

- [ ] Migration plan reviewed
- [ ] Environment variables configured
- [ ] Secrets rotated if needed
- [ ] Database backup taken
- [ ] Stellar network confirmed (testnet for non-prod)
- [ ] Health endpoint verified
- [ ] Monitoring dashboards checked

## Infrastructure Requirements

| Service | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary database |
| Redis | 7 | Queue backend, caching |
| Object Storage | S3-compatible | Document file storage |
| Stellar Horizon | testnet/mainnet | Blockchain anchoring |

## Stellar Network per Environment

| Environment | Network | Horizon URL |
|---|---|---|
| Development | Testnet | `https://horizon-testnet.stellar.org` |
| Staging | Testnet | `https://horizon-testnet.stellar.org` |
| Production | Mainnet | `https://horizon.stellar.org` |
