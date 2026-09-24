# Retry, backoff and jitter configuration

`contract/src/retry.rs` implements retry-with-backoff and jitter for
Horizon calls. The relevant environment variables are:

| Variable | Default | Description |
|---|---|---|
| `RETRY_MAX_ATTEMPTS` | `3` | Maximum number of retry attempts before giving up. |
| `RETRY_BASE_DELAY_MS` | `200` | Base delay before the first retry, in milliseconds. |
| `RETRY_MAX_DELAY_MS` | `5000` | Upper bound on the backoff delay. |
| `RETRY_JITTER_RATIO` | `0.2` | Fraction of the computed delay randomized as jitter. |

## Tuning guidance

- Increase `RETRY_MAX_ATTEMPTS` for latency-tolerant batch workloads.
- Lower `RETRY_MAX_DELAY_MS` for latency-sensitive interactive requests.
- Keep `RETRY_JITTER_RATIO` above `0` in multi-instance deployments to
  avoid synchronized retry storms against Horizon.
