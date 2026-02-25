# Document Revocation Endpoint

## Overview

The `/revoke` endpoint allows you to mark a previously anchored document as no longer valid on the Stellar blockchain. This is useful for cases such as fraud detection, document supersession, or other scenarios where a document needs to be invalidated.

## Endpoint

```
POST /revoke
```

## Request Body

```json
{
  "document_hash": "abc123def456...",
  "reason": "Document superseded by newer version",
  "revoked_by": "admin@example.com"
}
```

### Fields

- `document_hash` (string, required): The hash of the document to revoke. Must exist on the blockchain.
- `reason` (string, required): The reason for revocation (e.g., "fraud", "superseded", "error").
- `revoked_by` (string, required): Identifier of the person or system performing the revocation.

## Response

### Success (200 OK)

```json
{
  "transaction_id": "stellar_tx_id_here",
  "revoked_at": 1709123456
}
```

### Error Responses

#### 404 Not Found

When the document hash doesn't exist on the blockchain:

```json
{
  "error": "Document hash not found",
  "message": "The document hash 'abc123...' does not exist on the blockchain"
}
```

#### 500 Internal Server Error

When there's a failure verifying or submitting the revocation:

```json
{
  "error": "Failed to submit revocation",
  "message": "Error details here"
}
```

## Behavior

1. **Verification**: Before revoking, the endpoint verifies that the document hash exists on the Stellar blockchain.
2. **Stellar Transaction**: A revocation transaction is submitted to Stellar with a memo in the format: `REVOKE:<hash>` (truncated to 28 bytes).
3. **Cache Invalidation**: Any cached verification results for the hash are automatically invalidated.
4. **Retry Logic**: The submission uses exponential backoff retry logic for transient failures.

## Example Usage

### Using curl

```bash
curl -X POST http://localhost:8080/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "document_hash": "a1b2c3d4e5f6...",
    "reason": "Document contains fraudulent information",
    "revoked_by": "fraud-detection-system"
  }'
```

### Using JavaScript/Fetch

```javascript
const response = await fetch("http://localhost:8080/revoke", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_hash: "a1b2c3d4e5f6...",
    reason: "Document superseded by v2",
    revoked_by: "document-management-system",
  }),
});

const result = await response.json();
console.log("Revoked at:", new Date(result.revoked_at * 1000));
console.log("Transaction ID:", result.transaction_id);
```

### Using Python/Requests

```python
import requests

response = requests.post(
    'http://localhost:8080/revoke',
    json={
        'document_hash': 'a1b2c3d4e5f6...',
        'reason': 'Compliance violation',
        'revoked_by': 'compliance-officer'
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"Revoked at: {data['revoked_at']}")
    print(f"Transaction ID: {data['transaction_id']}")
elif response.status_code == 404:
    print("Document hash not found on blockchain")
else:
    print(f"Error: {response.json()}")
```

## Implementation Details

### Stellar Memo Format

The revocation is recorded on Stellar with a structured memo:

- Format: `REVOKE:<document_hash>`
- Maximum length: 28 bytes (Stellar memo text limit)
- If the full string exceeds 28 bytes, it's truncated

### Cache Invalidation

After successful revocation, the cache entry for the document hash is deleted to ensure:

- Future verification requests don't return stale cached results
- The revocation status is reflected immediately in subsequent queries

### Retry Logic

The revocation submission uses the same retry logic as other Stellar operations:

- Maximum attempts: 3 (configurable via `STELLAR_MAX_RETRIES`)
- Initial delay: 100ms
- Exponential backoff with jitter
- Retries on network errors and 5xx responses
- No retry on 4xx client errors

## Security Considerations

1. **Authentication**: Consider adding authentication/authorization before allowing revocations in production.
2. **Audit Trail**: The `revoked_by` field provides accountability for who performed the revocation.
3. **Immutability**: While the revocation is recorded on the blockchain, the original document hash remains. The revocation is an additional record, not a deletion.
4. **Verification**: Always verify the hash exists before attempting revocation to prevent unnecessary blockchain transactions.

## Environment Variables

- `STELLAR_HORIZON_URL`: Stellar Horizon API endpoint
- `STELLAR_MAX_RETRIES`: Maximum retry attempts (default: 3)
- `REDIS_URL`: Redis cache connection string

## Related Endpoints

- `POST /verify`: Verify if a document hash exists on the blockchain
- `GET /verify/:hash`: Get verification status for a specific hash
- `POST /submit`: Submit a new document hash to the blockchain
