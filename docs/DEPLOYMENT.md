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

## Rollback Procedure

1. If deployment fails before DB migration: revert container version.
2. If deployment fails after DB migration: execute reverse migration script (`migration:revert`) prior to binary rollback.
