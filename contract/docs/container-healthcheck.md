# Container healthcheck

`contract/Dockerfile` defines a `HEALTHCHECK` (issue #1395) that calls the
service's `/health` endpoint:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 || exit 1
```

- `wget` is installed in the runtime image for this purpose.
- `${PORT}` defaults to `8080` via the image `ENV`.
- The container is marked unhealthy after 3 consecutive failures.
- `wget` exits non-zero on HTTP 4xx/5xx, so a `/health` response of 503
  (dependencies down) fails the check.
