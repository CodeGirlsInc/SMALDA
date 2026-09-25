# SMALDA Deployment & Environment Parity Guide

## Environments

| Environment | Database | Redis | Stellar Network | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | Postgres 16 (Local) | Redis 7 | Testnet | Local feature development |
| **Staging** | RDS Postgres 16 | ElastiCache Redis | Testnet | Integration and E2E testing |
| **Production** | Multi-AZ Postgres 16 | Redis Cluster | Mainnet | Institutional land record anchoring |

## Deployment Procedure

1. Run database migrations check.
2. Verify configuration schemas and secrets.
3. Deploy API backend and frontend artifacts.
4. Execute smoke tests on `/health` and `/metrics`.

## Browser Session Topology

Production browser sessions must use one of these supported topologies:

1. Serve the frontend and API through the same origin, including a reverse proxy or path-based gateway.
2. Serve the frontend and API on sibling hosts under one explicitly configured parent domain, such as `app.example.com` and `api.example.com`, and set `SESSION_COOKIE_DOMAIN=example.com`.

A host-only cookie cannot authenticate a middleware request on a different production host. The backend refuses production startup when `FRONTEND_URL` and `APP_URL` are on different hosts without a valid shared parent domain. Configure HTTPS and the exact frontend origin before enabling credentialed cookies.

OAuth callbacks redirect with a short-lived, one-time exchange code, never a JWT. The frontend exchanges it at `/api/v1/auth/oauth/exchange` and stores the returned session locally.

Logout writes a local-storage `logout-event`; the client session synchronizer clears each tab's user-scoped map selection before redirecting. `sessionStorage` is intentionally not treated as remotely clearable.

## Rollback Procedure

1. If deployment fails before DB migration: revert container version.
2. If deployment fails after DB migration: execute reverse migration script (`migration:revert`) prior to binary rollback.
