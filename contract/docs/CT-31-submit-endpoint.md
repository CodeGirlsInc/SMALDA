# POST /submit — Document Anchoring (CT-31)

`submit_document()` in `contract/src/lib.rs` is a real handler:

- Takes `State<AppState>`, so it has access to the Stellar client, cache and metrics.
- Normalizes and validates the SHA-256 hash, returning `400` on malformed input.
- Idempotent: returns the cached anchor result on a duplicate submission
  (`stellar:verify:{hash}` cache key).
- Increments the request metric, then anchors the hash on Stellar via
  `StellarClient::anchor_hash(...)`.
- On success, caches the `SubmitResponse` (1-year TTL) and returns `200` with the
  transaction id and `anchored_at`; failures increment the error metric.
