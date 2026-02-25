# Document Revocation Flow

## High-Level Flow Diagram

```
┌─────────────┐
│   Client    │
│  (Request)  │
└──────┬──────┘
       │
       │ POST /revoke
       │ {
       │   "document_hash": "abc123...",
       │   "reason": "superseded",
       │   "revoked_by": "admin"
       │ }
       │
       ▼
┌──────────────────────────────────────┐
│     Axum API Handler                 │
│  (revoke_document)                   │
└──────┬───────────────────────────────┘
       │
       │ Step 1: Verify hash exists
       ▼
┌──────────────────────────────────────┐
│   StellarClient::verify_hash()       │
│   - Query Stellar Horizon API        │
│   - Check if hash exists on-chain    │
└──────┬───────────────────────────────┘
       │
       ├─── Hash NOT found ───┐
       │                      │
       │                      ▼
       │              ┌───────────────┐
       │              │  Return 404   │
       │              │  "Hash not    │
       │              │   found"      │
       │              └───────────────┘
       │
       │ Hash found
       │
       │ Step 2: Submit revocation
       ▼
┌──────────────────────────────────────┐
│   StellarClient::revoke_hash()       │
│   - Create memo: "REVOKE:<hash>"     │
│   - Submit to Stellar Horizon        │
│   - Retry with exponential backoff   │
└──────┬───────────────────────────────┘
       │
       ├─── Submission failed ───┐
       │                         │
       │                         ▼
       │                 ┌───────────────┐
       │                 │  Return 500   │
       │                 │  "Failed to   │
       │                 │   submit"     │
       │                 └───────────────┘
       │
       │ Submission successful
       │
       │ Step 3: Invalidate cache
       ▼
┌──────────────────────────────────────┐
│   CacheBackend::delete()             │
│   - Remove cached verification       │
│   - Ensure fresh data on next query  │
└──────┬───────────────────────────────┘
       │
       │ Step 4: Return success
       ▼
┌──────────────────────────────────────┐
│   Return 200 OK                      │
│   {                                  │
│     "transaction_id": "tx_123",      │
│     "revoked_at": 1709123456         │
│   }                                  │
└──────────────────────────────────────┘
```

## Detailed Sequence Diagram

```
Client          API Handler       StellarClient      Stellar Horizon      Cache
  │                 │                   │                   │               │
  │  POST /revoke   │                   │                   │               │
  ├────────────────>│                   │                   │               │
  │                 │                   │                   │               │
  │                 │  verify_hash()    │                   │               │
  │                 ├──────────────────>│                   │               │
  │                 │                   │  GET /transactions│               │
  │                 │                   ├──────────────────>│               │
  │                 │                   │                   │               │
  │                 │                   │   Response        │               │
  │                 │                   │<──────────────────┤               │
  │                 │                   │                   │               │
  │                 │  VerificationResult                   │               │
  │                 │<──────────────────┤                   │               │
  │                 │                   │                   │               │
  │                 │ [if not verified] │                   │               │
  │   404 Error     │                   │                   │               │
  │<────────────────┤                   │                   │               │
  │                 │                   │                   │               │
  │                 │ [if verified]     │                   │               │
  │                 │  revoke_hash()    │                   │               │
  │                 ├──────────────────>│                   │               │
  │                 │                   │ POST /transactions│               │
  │                 │                   ├──────────────────>│               │
  │                 │                   │  (with REVOKE:... memo)           │
  │                 │                   │                   │               │
  │                 │                   │   Response        │               │
  │                 │                   │<──────────────────┤               │
  │                 │                   │                   │               │
  │                 │  transaction_id   │                   │               │
  │                 │<──────────────────┤                   │               │
  │                 │                   │                   │               │
  │                 │  delete(hash)     │                   │               │
  │                 ├───────────────────────────────────────────────────────>│
  │                 │                   │                   │               │
  │                 │  OK               │                   │               │
  │                 │<───────────────────────────────────────────────────────┤
  │                 │                   │                   │               │
  │   200 OK        │                   │                   │               │
  │<────────────────┤                   │                   │               │
  │  {tx_id, time}  │                   │                   │               │
  │                 │                   │                   │               │
```

## Retry Logic Flow

```
┌─────────────────────────────────────┐
│  Submit to Stellar Horizon          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Attempt 1                          │
└──────┬──────────────────────────────┘
       │
       ├─── Success ──────────────────┐
       │                              │
       │                              ▼
       │                      ┌───────────────┐
       │                      │  Return OK    │
       │                      └───────────────┘
       │
       ├─── 4xx Error ────────────────┐
       │                              │
       │                              ▼
       │                      ┌───────────────┐
       │                      │  Return Error │
       │                      │  (No Retry)   │
       │                      └───────────────┘
       │
       ├─── 5xx or Network Error
       │
       ▼
┌─────────────────────────────────────┐
│  Wait: 100ms * jitter               │
│  (jitter = 0.8 to 1.2)              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Attempt 2                          │
└──────┬──────────────────────────────┘
       │
       ├─── Success ──────────────────┐
       │                              │
       │                              ▼
       │                      ┌───────────────┐
       │                      │  Return OK    │
       │                      └───────────────┘
       │
       ├─── 4xx Error ────────────────┐
       │                              │
       │                              ▼
       │                      ┌───────────────┐
       │                      │  Return Error │
       │                      │  (No Retry)   │
       │                      └───────────────┘
       │
       ├─── 5xx or Network Error
       │
       ▼
┌─────────────────────────────────────┐
│  Wait: 200ms * jitter               │
│  (exponential backoff)              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Attempt 3 (Final)                  │
└──────┬──────────────────────────────┘
       │
       ├─── Success ──────────────────┐
       │                              │
       │                              ▼
       │                      ┌───────────────┐
       │                      │  Return OK    │
       │                      └───────────────┘
       │
       └─── Any Error ────────────────┐
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Return Error │
                              │  (Max retries)│
                              └───────────────┘
```

## Cache Invalidation Flow

```
┌─────────────────────────────────────┐
│  Revocation Successful              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  CacheBackend::delete(hash)         │
└──────┬──────────────────────────────┘
       │
       ├─── Redis Backend
       │
       ▼
┌─────────────────────────────────────┐
│  Redis DEL command                  │
│  - Removes key from Redis           │
│  - Immediate effect                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Next verify request                │
│  - Cache miss                       │
│  - Fresh query to Stellar           │
│  - Will see revocation              │
└─────────────────────────────────────┘
```

## Error Handling Decision Tree

```
                    ┌─────────────────┐
                    │  Revoke Request │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Verify Hash    │
                    │  Exists?        │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
         ┌──────────┐            ┌──────────────┐
         │   YES    │            │      NO      │
         └────┬─────┘            └──────┬───────┘
              │                         │
              │                         ▼
              │                  ┌──────────────┐
              │                  │  Return 404  │
              │                  │  "Not Found" │
              │                  └──────────────┘
              │
              ▼
    ┌─────────────────┐
    │ Submit to       │
    │ Stellar         │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│ Success │    │    Failed    │
└────┬────┘    └──────┬───────┘
     │                │
     │                ▼
     │         ┌──────────────┐
     │         │  Return 500  │
     │         │  "Submit     │
     │         │   Failed"    │
     │         └──────────────┘
     │
     ▼
┌─────────────────┐
│ Invalidate      │
│ Cache           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return 200 OK  │
│  {tx_id, time}  │
└─────────────────┘
```

## State Transitions

```
Document States:

┌──────────────┐
│   Anchored   │  ← Initial state after document submission
│  (Verified)  │
└──────┬───────┘
       │
       │ POST /revoke
       │ (with valid reason)
       │
       ▼
┌──────────────┐
│   Revoked    │  ← Final state (immutable on blockchain)
│  (Invalid)   │
└──────────────┘

Note: Both states exist on blockchain.
Revocation is an additional record, not a deletion.
```

## Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                    External Systems                     │
└─────────────────────────────────────────────────────────┘
                             │
                             │ HTTP/JSON
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  Revocation Endpoint                    │
│                    (POST /revoke)                       │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
       │ Verify                           │ Submit
       │                                  │
       ▼                                  ▼
┌──────────────────┐            ┌──────────────────┐
│  Stellar Horizon │            │  Stellar Horizon │
│  (Read API)      │            │  (Write API)     │
└──────────────────┘            └──────────────────┘
       │                                  │
       │                                  │
       └──────────────┬───────────────────┘
                      │
                      ▼
              ┌──────────────────┐
              │ Stellar Ledger   │
              │ (Immutable)      │
              └──────────────────┘
```

## Summary

The revocation flow ensures:

1. **Verification**: Hash must exist before revocation
2. **Immutability**: Revocation recorded on blockchain
3. **Cache Consistency**: Stale data removed immediately
4. **Resilience**: Automatic retries for transient failures
5. **Audit Trail**: Complete record of who revoked and why
