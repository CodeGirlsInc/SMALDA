# CORS preflight handling and verification-cache invalidation

Covers #1387 and #1388.

## CORS / OPTIONS handling (#1387)

Browser clients send a preflight `OPTIONS` request before any cross-origin request that uses a
non-simple method, a JSON `Content-Type`, or an `Authorization` header.

- `OPTIONS` requests on any API route must be answered **before** authentication, with `204 No Content`.
- Responses must include:
  - `Access-Control-Allow-Origin`: the request origin, only if it is in the configured allow-list (never `*` together with credentials)
  - `Access-Control-Allow-Methods`: `GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers`: `Authorization, Content-Type`
  - `Access-Control-Max-Age`: `600`
  - `Vary: Origin`
- Origins that are not in the allow-list receive no CORS headers, so the browser blocks the call.

## Cache invalidation on revoke (#1388)

A cached verification result must never outlive the revocation of its document.

1. `handlers/revoke.rs` revokes the document in the store.
2. Only after the revoke succeeds, it calls `cache.invalidate(&document_hash)` (removes the entry from `cache.rs`).
3. A verification lookup after step 2 misses the cache and reads the revoked state from the store.

Rules:
- Invalidate **after** a successful revoke, never before, so a failed revoke does not drop valid cache entries.
- Invalidation is keyed by document hash, the same key used for the cached verification result.
- Revoking an already revoked or uncached document is a no-op for the cache (idempotent).

Suggested regression test: verify (cache fills) -> revoke -> verify again must return `revoked`, not the cached `verified`.
