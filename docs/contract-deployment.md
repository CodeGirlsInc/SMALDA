# Deployment guide — `stellar-doc-verifier` (Rust / Axum)

This document covers only the **contract** service that lives in `contract/`. It does not duplicate the top-level deployment notes in `docs/DEPLOYMENT.md`, which describe the broader platform.

The `contract/` runtime service (`stellar-doc-verifier`) is an Axum HTTP service written in Rust 1.75 (edition 2021).

## Overview

The verifier runs as a single binary that:

- Exposes the HTTP API on `${PORT:-8080}` (default 8080).
- Speaks HTTPS outbound to a Stellar Horizon instance (default: the SDF public testnet at `https://horizon-testnet.stellar.org`).
- Maintains a small Redis-backed cache for verification results, idempotency, and submit-side de-duplication.

### Resource expectations

| Resource | Recommendation                                                       |
| -------- | -------------------------------------------------------------------- |
| CPU      | 0.5 vCPU sustained, 1 vCPU for bursty batch verification             |
| Memory   | 256 MiB resident; watch RSS under `verify/batch` (50 hashes x concurrency) |
| Disk     | Stateless — no persistent disk required                              |
| Network  | Outbound TCP/443 to Horizon; outbound Redis (default 6379)           |

## Environment variables

| Variable                       | Default                              | Notes                                                                                       |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `APP_ENV`                      | `development`                        | `production` switches structured logging to JSON.                                           |
| `PORT`                         | `8080`                               | TCP port the HTTP server listens on.                                                        |
| `STELLAR_HORIZON_URL`          | `https://horizon-testnet.stellar.org` | Any HTTPS-reachable Horizon instance.                                                       |
| `STELLAR_SECRET_KEY`           | **required**                         | 56-char anchor-account seed; consumed only on `/submit` and `/revoke`.                      |
| `STELLAR_MAX_RETRIES`          | `3`                                  | Upper bound on retry attempts per Horizon call.                                              |
| `HORIZON_RETRY_INITIAL_BACKOFF_MS` | `200`                            | Initial exponential back-off for the first retry.                                           |
| `HORIZON_RETRY_MAX_BACKOFF_MS`     | `5000`                           | Cap on a single back-off interval (including jitter).                                       |
| `HORIZON_RETRY_JITTER`             | `0.25`                           | Jitter factor in `[0, 1]`.                                                                  |
| `HORIZON_CB_FAILURE_THRESHOLD`     | `5`                              | Consecutive Horizon failures before the circuit breaker opens.                             |
| `HORIZON_CB_COOLDOWN_SECS`         | `30`                             | How long the breaker stays `Open` before allowing a `HalfOpen` probe.                       |
| `REDIS_URL`                    | `redis://127.0.0.1:6379`             | Redis connection string for caching.                                                        |
| `CACHE_VERIFICATION_TTL`       | `3600`                               | Seconds to cache `VerifyResponse` results.                                                   |
| `RATE_LIMIT_PER_SECOND`        | `10`                                 | `governor` token-bucket refill rate.                                                         |
| `RATE_LIMIT_BURST`             | `RATE_LIMIT_PER_SECOND`              | `governor` token-bucket capacity.                                                            |
| `LOG_LEVEL`                    | `info`                               | Passed straight through to `tracing-subscriber`.                                            |
| `WEBHOOK_URLS`                 | *(empty)*                            | Comma-separated list of URLs to fan out webhook events to.                                  |
| `WEBHOOK_SECRET`               | *(empty)*                            | HMAC secret for outbound webhook payloads.                                                  |
| `SHUTDOWN_TIMEOUT_SECS`        | `30`                                 | Maximum time the process will spend draining in-flight requests on SIGTERM.                 |

## Building locally

```bash
cd contract
cargo build --release --locked
./target/release/stellar-doc-verifier
```

## Format, lint, and test

CI runs four checks that you should run locally before pushing:

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --all
cargo test --all
```

## Container image

```bash
docker build -f contract/Dockerfile -t stellar-doc-verifier:local .
docker run --rm -p 8080:8080 \
    -e STELLAR_SECRET_KEY=S... \
    -e STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org \
    -e REDIS_URL=redis://host.docker.internal:6379 \
    stellar-doc-verifier:local
```

The container:

- Builds on `rust:1.75-slim-bookworm` using **`cargo-chef`** so the dep graph is cached independently of the application source.
- Ships on `debian:bookworm-slim` (~ 80 MB).
- Runs as a dedicated non-root user (`stellar`, uid 1001).
- Includes a `HEALTHCHECK` that probes `/health` every 30 s.
- Uses `tini` as PID 1 so SIGTERM cleanly reaches the Rust process.

## Local Compose

The repo's top-level `docker-compose.yml` brings the whole stack up locally — including the verifier. To start everything:

```bash
docker compose up -d --build
```

The verifier service is wired to the `redis` network and depends on the Redis service being healthy. From inside Compose the service DNS name is `stellar-doc-verifier` and the port is `8080` — for example:

```env
# backend/.env
STELLAR_VERIFIER_URL=http://stellar-doc-verifier:8080
```

## Kubernetes

The container is stateless and exposes a single port. A minimal Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stellar-doc-verifier
  labels: { app: stellar-doc-verifier }
spec:
  replicas: 2
  selector:
    matchLabels: { app: stellar-doc-verifier }
  template:
    metadata:
      labels: { app: stellar-doc-verifier }
    spec:
      containers:
        - name: verifier
          image: stellar-doc-verifier:0.1.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet: { path: /health, port: 8080 }
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /health, port: 8080 }
            initialDelaySeconds: 30
            periodSeconds: 30
          env:
            - name: APP_ENV
              value: production
            - name: PORT
              value: "8080"
            - { name: STELLAR_HORIZON_URL, value: https://horizon-testnet.stellar.org }
            - { name: STELLAR_SECRET_KEY,  valueFrom: { secretKeyRef: { name: stellar-secret, key: key } } }
            - { name: REDIS_URL,          value: redis://redis:6379 }
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits:   { cpu: 500m, memory: 256Mi }
```

## Horizontal scaling

Each request to `/verify` and `/verify/:hash` is bounded by a single Horizon round-trip, so the service scales near-linearly with `replicas`. Cache hits short-circuit Horizon entirely.

## Operational signals

- **`/metrics`** — Prometheus exposition. Counters: `requests_total`, `cache_hits_total`, `cache_misses_total`, `errors_total`, `horizon_retries_total`, `horizon_circuit_opens_total`. Gauge: `horizon_circuit_state` (0=closed, 1=open, 2=half-open).
- **`/health`** — JSON readiness payload that includes the circuit-breaker state. Returns 200 when both Stellar and Redis are reachable.

## Failure modes

| Condition                                       | Behaviour                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Horizon 5xx or network timeout                  | Retried with bounded exponential back-off + jitter up to `STELLAR_MAX_RETRIES + 1` attempts.            |
| Horizon 429                                     | Treated as retryable; honoured after back-off.                                                           |
| Horizon 400-class (other than 429)              | Bubbled immediately as `AppError::BadGateway`. **Not retried** so a malformed request doesn't loop.     |
| Horizon sustained failure                       | Circuit breaker opens after `HORIZON_CB_FAILURE_THRESHOLD` consecutive failures. Fails fast for `HORIZON_CB_COOLDOWN_SECS`, then a single `HalfOpen` probe is admitted. |
| Retry exhaustion or breaker open                | The request returns an **indeterminate** response (HTTP 503 with `status: "indeterminate"`). The body never claims `verified: false`, so a caller cannot mistake an upstream outage for a genuine verification failure. |
| Redis down                                      | Cache reads/writes degrade gracefully; the request still attempts the Horizon call (warning logged and `errors_total` incremented). |
