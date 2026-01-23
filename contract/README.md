# Stellar Document Verification Microservice

REST API microservice for verifying document authenticity using Stellar blockchain.

## Features

- ✅ REST API for verification requests
- ✅ Query Stellar Horizon for transaction data
- ✅ Verify document hashes against blockchain
- ✅ Redis caching for performance
- ✅ Rate limiting
- ✅ Health check endpoints
- ✅ Prometheus metrics
- ✅ Docker containerization
- ✅ Async request handling
- ✅ Comprehensive logging

## Prerequisites

- Rust 1.75+
- Docker & Docker Compose
- Redis (for local development)

## Quick Start

### Using Docker Compose

```bash
docker-compose up --build
```

### Local Development

```bash
# Install dependencies
cargo build

# Run Redis
docker run -p 6379:6379 redis:7-alpine

# Run service
cargo run
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Metrics
```bash
GET /metrics
```

### Verify Document (POST)
```bash
POST /verify
Content-Type: application/json

{
  "document_hash": "abc123...",
  "transaction_id": "optional-tx-id"
}
```

### Verify Document (GET)
```bash
GET /verify/{document_hash}
```

## Environment Variables

```bash
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
REDIS_URL=redis://127.0.0.1:6379
RUST_LOG=info
```

## Testing

```bash
# Unit tests
cargo test

# Load test (requires wrk)
wrk -t4 -c100 -d30s http://localhost:8080/health
```

## Performance

- Target: >100 requests/second
- Caching reduces Stellar API calls
- Async Tokio runtime for concurrency

## Monitoring

Prometheus metrics available at `/metrics`:
- `requests_total` - Total API requests
- `cache_hits_total` - Cache hit count
- `cache_misses_total` - Cache miss count
- `errors_total` - Error count

## Production Deployment

1. Build Docker image:
```bash
docker build -t stellar-verifier .
```

2. Run with production config:
```bash
docker run -p 8080:8080 \
  -e STELLAR_HORIZON_URL=https://horizon.stellar.org \
  -e REDIS_URL=redis://redis:6379 \
  stellar-verifier
```

## Architecture

```
Client Request → Axum Router → Rate Limiter → Cache Check → Stellar Query → Response
                                                    ↓
                                                  Redis
```
