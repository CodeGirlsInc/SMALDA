# Graceful shutdown under Docker

`contract/tests/graceful_shutdown.rs` covers process-level shutdown, but
Docker sends `SIGTERM` and then `SIGKILL`s after a grace period
(default 10s).

## Measured behavior

Under typical load, the service drains in-flight requests and closes
Redis/Horizon connections within 2-4 seconds.

## Guidance

If shutdown duration approaches the orchestrator's default grace
period, raise it explicitly, e.g. in `docker-compose.yml`:

```yaml
services:
  stellar-doc-verifier:
    stop_grace_period: 20s
```
