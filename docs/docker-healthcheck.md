# Docker HEALTHCHECK configuration

The `stellar-doc-verifier` container's HEALTHCHECK targets the `/health`
endpoint so Docker can mark the container unhealthy when a dependency
(Redis/Horizon) is unreachable.

## Configuration

```
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## Manual verification

1. Start the stack: `docker compose up -d --build stellar-doc-verifier`.
2. Simulate a dependency outage, e.g. `docker compose stop redis`.
3. Confirm `docker inspect --format='{{.State.Health.Status}}' <container>`
   reports `unhealthy` within the configured healthcheck window.
