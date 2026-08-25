# Verification History (CT-36)

`GET /verify/:hash/history` (`verify_document_history`) reads the
`history:{normalized_hash}` cache key and returns the recorded verification /
transfer events for a document, or an empty list when none exist.

## How the key is populated

`record_transfer()` appends a `TransferRecord` to `history:{hash}` (10-year TTL)
whenever a transfer is anchored, so repeated activity on a document accumulates a
readable history rather than leaving the endpoint permanently empty.

## Shape

Each entry carries the transfer/verification metadata (hashes, memo, timestamp)
so third parties can independently review a document's lifecycle.
