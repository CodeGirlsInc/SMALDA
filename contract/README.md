# Stellar Document Verification Service

A high-performance Rust service for verifying and managing document hashes on the Stellar blockchain.

## Features

- Document hash verification against Stellar blockchain
- Document revocation with audit trail
- Redis caching for improved performance
- Exponential backoff retry logic for resilient API calls
- Prometheus metrics for monitoring
- Rate limiting to prevent abuse

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status and connectivity to Stellar and Redis.

### Metrics

```
GET /metrics
```

Returns Prometheus-formatted metrics.

### Verify Document (POST)

```
POST /verify
Content-Type: application/json

{
  "document_hash": "abc123...",
  "transaction_id": "optional_tx_id"
}
```

Verifies if a document hash exists on the Stellar blockchain.

### Verify Document (GET)

```
GET /verify/:hash
```

Verifies a document hash via URL parameter.

### Revoke Document

```
POST /revoke
Content-Type: application/json

{
  "document_hash": "abc123...",
  "reason": "Document superseded",
  "revoked_by": "admin@example.com"
}
```

Revokes a previously anchored document. See [REVOKE_ENDPOINT.md](./REVOKE_ENDPOINT.md) for detailed documentation.

## Configuration

Create a `.env` file in the contract directory:

```env
# Stellar Configuration
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_MAX_RETRIES=3

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379

# Logging
RUST_LOG=debug
```

## Installation

### Prerequisites

- Rust 1.70 or later
- Redis server
- Access to Stellar Horizon API

### Build

```bash
cargo build --release
```

### Run

```bash
cargo run
```

The service will start on `http://0.0.0.0:8080` by default.

## Testing

Run the test suite:

```bash
cargo test
```

Run integration tests:

```bash
cargo test --test integration_test
```

## Retry Logic

All Stellar API calls include automatic retry logic with exponential backoff:

- **Max attempts**: 3 (configurable via `STELLAR_MAX_RETRIES`)
- **Initial delay**: 100ms
- **Max delay**: 10 seconds
- **Backoff multiplier**: 2.0
- **Jitter**: Random factor between 0.8 and 1.2 applied to delays

Retries are triggered for:

- Network errors (connection refused, timeout)
- HTTP 5xx server errors

Retries are NOT triggered for:

- HTTP 4xx client errors

## Cache Invalidation

The service automatically invalidates cached verification results when:

- A document is revoked
- Cache TTL expires (default: 3600 seconds)

## Monitoring

The service exposes Prometheus metrics at `/metrics`:

- `stellar_doc_verifier_requests_total`: Total number of requests
- `stellar_doc_verifier_cache_hits_total`: Cache hit count
- `stellar_doc_verifier_cache_misses_total`: Cache miss count
- `stellar_doc_verifier_errors_total`: Error count

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Axum API   │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────┐
│   Redis     │  │ Stellar  │
│   Cache     │  │ Horizon  │
└─────────────┘  └──────────┘
```

## Development

### Code Structure

```
contract/src/
├── main.rs          # Application entry point
├── lib.rs           # Core library and handlers
├── stellar.rs       # Stellar client with retry logic
├── cache.rs         # Redis and in-memory cache
├── config.rs        # Configuration management
├── metrics.rs       # Prometheus metrics
└── rate_limit.rs    # Rate limiting
```

### Adding New Endpoints

1. Define request/response types in `lib.rs`
2. Implement handler function
3. Add route in the `app()` function
4. Add tests in `tests/integration_test.rs`

## Security Considerations

- Always validate input hashes
- Implement authentication for production use
- Use HTTPS in production
- Rotate Redis credentials regularly
- Monitor for unusual activity via metrics

## Performance

- Cached responses: < 10ms
- Uncached Stellar queries: 100-500ms (depending on network)
- Retry overhead: Minimal with exponential backoff
- Concurrent requests: Handled via Tokio async runtime

## Troubleshooting

### Connection Refused to Redis

Ensure Redis is running:

```bash
redis-cli ping
```

### Stellar API Errors

Check Horizon status and your network connectivity. The service will automatically retry transient failures.

### High Memory Usage

Adjust cache TTL or switch to Redis-only caching for large deployments.

## License

See the main project LICENSE file.

## Contributing

See the main project CONTRIBUTING guidelines.
