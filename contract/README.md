# stellar-doc-verifier

> **This is not a smart contract.** Despite living in a directory named
> `contract/` and being built by a CI job labelled "SMART CONTRACTS: Rust /
> Cargo", `stellar-doc-verifier` is a standalone [Axum](https://github.com/tokio-rs/axum)
> HTTP web service written in Rust. It contains no Soroban code and deploys
> no on-chain contract. It anchors and verifies document hashes on the
> Stellar network by reading and writing `ManageData` entries via the
> [Horizon](https://developers.stellar.org/docs/data/horizon) API: the same
> kind of interaction any off-chain client can perform.
>
> Renaming this directory (e.g. to `verifier/`) and renaming the CI job are
> tracked as a follow-up; see [Known issues](#known-issues) below. Until
> that happens, treat every mention of "contract" in paths and CI output as
> a legacy name, not a description of what's inside.

## What this service does

`stellar-doc-verifier` anchors document hashes to the Stellar ledger and
later verifies, revokes, or transfers ownership of them:

- **Submit** a document hash: it's written to a single configured Stellar
  account as a `ManageData` entry (`doc_<hash prefix>`), which acts as an
  immutable, timestamped anchor.
- **Verify** a hash: the service reads that account's data entries from
  Horizon and reports whether the hash is anchored, along with the raw and
  decoded on-chain value.
- **Revoke** a previously anchored hash: writes a second `ManageData` entry
  (`revoked_<hash prefix>`) recording who revoked it and why, without
  deleting the original anchor.
- **Record an ownership transfer**: computes a deterministic transfer hash
  from the document hash and the parties involved, anchors it via
  `ManageData` (`trf_<hash prefix>`), and encodes a short memo.
- **Cache** verification results in Redis (or an in-process map) to avoid
  re-querying Horizon on every request, and expose Prometheus metrics for
  request counts, cache hit/miss rates, and errors.

All on-chain writes go through **one Stellar account**, derived from a
single configured secret key (`STELLAR_SECRET_KEY`). The service does not
manage per-user Stellar accounts or keys: callers identify documents by
hash, not by their own Stellar identity.

## Relationship to the NestJS backend and the Stellar network

**There currently is no relationship.** The `backend/` NestJS application
has its own, independent Stellar integration (`backend/src/stellar/`) that
talks to Horizon directly. Nothing in `backend/src` calls this service, and
nothing here calls into the NestJS backend. The two are parallel, separate
implementations of similar hash-anchoring logic against the same Stellar
network: not a client/server pair.

If the intent going forward is for the NestJS backend to delegate to this
service (or vice versa), that integration doesn't exist yet and should be
scoped as its own piece of work, not assumed from the directory structure.

This service talks directly to the **Stellar network** via a configured
Horizon endpoint (`STELLAR_HORIZON_URL`, defaulting to the public testnet
Horizon). It does not talk to Soroban, and does not interact with any
smart contract.

## HTTP API

All request/response bodies are JSON. There is currently **no
authentication or authorization middleware** on any route: every endpoint
below is open to any caller who can reach the service. There is also no
rate-limiting middleware currently active (see [Known issues](#known-issues)).

### `GET /health`

Liveness/readiness check. Pings both Stellar (via Horizon) and Redis.

**Response `200`**
```json
{
  "status": "healthy",       // "healthy" or "degraded"
  "stellar_connected": true,
  "redis_connected": true
}
```
`status` is `"degraded"` if either dependency check fails; the endpoint
still returns `200` either way.

### `GET /metrics`

Prometheus text-format metrics: `requests_total`, `cache_hits_total`,
`cache_misses_total`, `errors_total`.

**Response `200`**: `text/plain` Prometheus exposition format.

### `POST /verify`

Verify a document hash. Checks the cache first, then Horizon on a miss.

**Request**
```json
{
  "document_hash": "e3b0c...855",   // required, 64-char hex SHA-256
  "transaction_id": null            // optional, currently unused by verification logic
}
```

**Response `200`**
```json
{
  "verified": true,
  "transaction_id": null,
  "timestamp": null,
  "cached": false,
  "revoked": null,
  "revoked_at": null
}
```
`revoked`/`revoked_at` are omitted from the JSON entirely when `null`.

**Errors**
| Status | Condition |
|---|---|
| `400` | Hash is empty, wrong length, or contains non-hex characters: body is `{ "error": "<message>" }` |
| `500` | Failed to derive the anchor account, or the Horizon query failed |

### `GET /verify/:hash`

Same behavior as `POST /verify`, with the hash taken from the path instead
of the body. Same request validation, response shape, and error codes.

### `GET /verify/:hash/history`

Returns cached transaction history for a hash (`history:<hash>` in the
cache). This reads only from cache: it does not query Horizon directly for
fresh operation history.

**Response `200`**
```json
{
  "document_hash": "e3b0c...855",
  "transactions": [
    { "transaction_id": "...", "timestamp": 0, "verified": true }
  ],
  "count": 1,
  "cached": true
}
```

**Errors**: `400` for an invalid hash (same shape as `/verify`); `500` on
cache read failure.

### `POST /verify/batch`

Verify up to 50 hashes concurrently.

**Request**
```json
{ "hashes": ["e3b0c...855", "..."] }
```

**Response `200`**
```json
{
  "results": [
    {
      "hash": "e3b0c...855",
      "verified": true,
      "transaction_id": null,
      "timestamp": null,
      "error": null
    }
  ],
  "total": 1,
  "verified_count": 1,
  "failed_count": 0
}
```
Per-hash failures (bad format, Horizon error) are reported inside
`results[i].error` with `verified: false` for that entry: they do not fail
the whole batch. The only whole-request `400`s are an empty `hashes` array
or more than 50 hashes.

### `POST /submit`

Anchor a new document hash on Stellar via `ManageData`. Idempotent:
resubmitting an already-anchored hash returns the cached original result
with `200` rather than re-anchoring.

**Request**
```json
{
  "document_hash": "e3b0c...855",
  "document_id": "doc-123",
  "submitter": "alice"
}
```

**Response `200`**
```json
{
  "success": true,
  "transaction_id": "abcd...",
  "anchored_at": 1700000000,
  "error": null
}
```

**Errors**
| Status | Condition |
|---|---|
| `400` | Invalid hash format |
| `502` | Horizon rejected or failed to submit the anchoring transaction: body has `success: false` and `error` set |

### `POST /revoke`

Record a revocation for a previously anchored hash. Requires a prior
successful `/submit` for the same hash (checked via cache, not a fresh
Horizon lookup).

**Request**
```json
{
  "document_hash": "e3b0c...855",
  "reason": "superseded by v2",
  "revoked_by": "alice"
}
```

**Response `200`**
```json
{
  "transaction_id": "abcd...",
  "revoked_at": 1700000000,
  "revoked": true
}
```

**Errors**
| Status | Condition |
|---|---|
| `400` | Invalid hash format |
| `404` | No prior anchor record found in cache for this hash |
| `502` | Horizon rejected or failed to submit the revocation transaction |

### `POST /transfer`

Anchor an ownership transfer for a document and persist its history in
Redis (keyed as `transfer:<document_hash>`, retained ~10 years).

**Request**
```json
{
  "document_hash": "e3b0c...855",
  "from_owner": "alice",
  "to_owner": "bob",
  "transfer_date": "2026-01-15",
  "transfer_reference": "REF-001"
}
```

**Response `200`**
```json
{
  "transfer_hash": "...",
  "memo": "TRANSFER:..."
}
```
`memo` is truncated to fit Stellar's 28-byte text memo limit.

**Errors**
| Status | Condition |
|---|---|
| `400` | `transfer_date` is not a valid `YYYY-MM-DD` date |
| `500` | Failed to derive the anchor account, read/write transfer history in cache |
| `502` | Horizon rejected or failed to submit the transfer transaction (surfaced as `500`, not `502`, in the current handler: see [Known issues](#known-issues)) |

## Module layout

| Module | Responsibility |
|---|---|
| `main.rs` | Binary entry point: loads config, initializes tracing, constructs `AppState`, starts the Axum server. |
| `lib.rs` | `AppState`, all HTTP request/response types, the `app()` router, and every route handler. |
| `config.rs` | `AppConfig::from_env()`: reads and validates all environment variables into a single typed config, collecting *all* validation errors before failing rather than stopping at the first one. |
| `stellar.rs` | `StellarClient`: all Horizon HTTP interaction: fetching account state, building/signing/submitting `ManageData` transactions for anchoring, revoking, and transferring, and reading operation history. Also owns the `ManageData` key-naming scheme (`doc_`, `trf_`, `revoked_` prefixes). |
| `cache.rs` | `CacheBackend`: a small abstraction over Redis (`RedisCache`) or an in-process `HashMap` (`InMemoryCache`), used for verification results and transfer/verification history. |
| `hash_validator.rs` | `HashValidator`: normalizes and validates hex-encoded SHA-256/SHA-512 hashes, with structured validation errors. |
| `metrics.rs` | `MetricsRegistry`: Prometheus counters (requests, cache hits/misses, errors) and text-format rendering for `/metrics`. |
| `rate_limit.rs` | A `governor`-based rate limiter builder. **Not currently wired into `app()`**: see [Known issues](#known-issues). |

## Known issues

Documenting these here rather than silently working around them, since a
new contributor hitting them would otherwise reasonably assume they're
missing something:

- **`rate_limit.rs` is dead code.** `build_rate_limiter()` is never called
  from `main.rs` or `app()`. `AppConfig` still parses
  `RATE_LIMIT_PER_SECOND` / `RATE_LIMIT_BURST`, but neither value is
  currently enforced anywhere.
- **`event.rs` is not part of the compiled crate.** `lib.rs` does not
  declare `pub mod event;`, and the file references `crate::error::Result`
  / `crate::error::AuditError`, which don't exist in this crate. It appears
  to be leftover/orphaned code from a different module structure.
- **`transfer_document` and `get_transfer_history` in `lib.rs` are unused.**
  The live `app()` router wires `/transfer` to `record_transfer`, not to
  `transfer_document` (which always returns "not yet implemented"). There
  is no live route for reading transfer history back out: only
  `record_transfer`'s write path and `verify_document_history`'s (separate)
  read path are actually routed.
- **No authentication.** No route requires any credential today, despite
  `submit`/`revoke`/`transfer` all being state-changing, chain-writing
  operations.
- **`webhook_urls` / `webhook_secret` are parsed but unused.** `AppConfig`
  reads `WEBHOOK_URLS` and `WEBHOOK_SECRET` from the environment; nothing
  in the current codebase sends a webhook.

If you pick up any of these, open a separate issue rather than folding a
behavior change into a documentation PR.

## Local setup

**Toolchain**: stable Rust (edition 2021) with `rustfmt` and `clippy`
components: the same toolchain CI uses (`dtolnay/rust-toolchain@stable`).

**Redis**: required at runtime (`redis` crate with `tokio-comp` +
`connection-manager`). Run one locally, e.g.:
```bash
docker run -p 6379:6379 redis:7
```

**Environment variables**: copy `contract/.env.example` to `contract/.env`
(or export these directly) and fill in the required ones:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `8080` | Must be `1`-`65535`. |
| `STELLAR_HORIZON_URL` | no | `https://horizon-testnet.stellar.org` | Must be a valid URL. |
| `STELLAR_SECRET_KEY` | **yes** | none | 56-character Stellar secret seed, starts with `S`. The single account all `ManageData` anchors are written to. |
| `REDIS_URL` | no | `redis://127.0.0.1:6379` | |
| `RATE_LIMIT_PER_SECOND` | no | `10` | Parsed and validated but not currently enforced: see [Known issues](#known-issues). |
| `RATE_LIMIT_BURST` | no | same as `RATE_LIMIT_PER_SECOND` | Same caveat. |
| `STELLAR_MAX_RETRIES` | no | `3` | |
| `LOG_LEVEL` | no | `info` | Used as the default `tracing` filter if `RUST_LOG` isn't set. |
| `WEBHOOK_URLS` | no | (empty) | Comma-separated. Parsed but currently unused. |
| `WEBHOOK_SECRET` | no | none | Parsed but currently unused. |
| `CACHE_VERIFICATION_TTL` | no | `3600` (seconds) | |

Note `contract/.env.example` currently lists only
`STELLAR_HORIZON_URL`, `STELLAR_MAX_RETRIES`, `REDIS_URL`, and `RUST_LOG` -
it's missing the required `STELLAR_SECRET_KEY` and several optional
variables above. Worth updating separately; the table here reflects what
`config.rs` actually reads.

**Running locally**
```bash
cd contract
export STELLAR_SECRET_KEY=S...   # required: a testnet account's secret seed
cargo run
```
The server listens on `0.0.0.0:$PORT` (default `8080`).

**Before opening a PR**, run the same three checks CI enforces:
```bash
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all
```

**Generating docs**:
```bash
cargo doc --no-deps --open
```
