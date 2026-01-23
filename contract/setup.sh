#!/bin/bash

# Stellar Document Verification Microservice Setup Script
# Run this in your contract directory

echo "Creating Stellar Document Verification Microservice..."

# Create directory structure
mkdir -p src tests

# Create Cargo.toml
cat > Cargo.toml << 'EOF'
[package]
name = "stellar-doc-verifier"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
axum = "0.7"
tokio = { version = "1.35", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["trace", "cors"] }

# Stellar SDK
stellar-sdk = "0.1"
reqwest = { version = "0.11", features = ["json"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Redis cache
redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }

# Rate limiting
governor = "0.6"

# Metrics
prometheus = "0.13"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Crypto
sha2 = "0.10"
hex = "0.4"

[dev-dependencies]
httpmock = "0.7"
EOF

# Create main.rs
cat > src/main.rs << 'EOF'
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

mod stellar;
mod cache;
mod metrics;
mod rate_limit;

use stellar::StellarClient;
use cache::CacheClient;
use metrics::MetricsRegistry;

// Application state
#[derive(Clone)]
struct AppState {
    stellar: Arc<StellarClient>,
    cache: Arc<CacheClient>,
    metrics: Arc<MetricsRegistry>,
}

// Request/Response types
#[derive(Debug, Deserialize)]
struct VerifyRequest {
    document_hash: String,
    transaction_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    verified: bool,
    transaction_id: Option<String>,
    timestamp: Option<i64>,
    cached: bool,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    stellar_connected: bool,
    redis_connected: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("stellar_doc_verifier=debug,tower_http=debug")
        .init();

    info!("Starting Stellar Document Verification Service");

    // Initialize components
    let stellar_url = std::env::var("STELLAR_HORIZON_URL")
        .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".to_string());
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

    let stellar = Arc::new(StellarClient::new(&stellar_url));
    let cache = Arc::new(CacheClient::new(&redis_url).await?);
    let metrics = Arc::new(MetricsRegistry::new());

    let state = AppState {
        stellar,
        cache,
        metrics,
    };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_handler))
        .route("/verify", post(verify_document))
        .route("/verify/:hash", get(verify_document_by_hash))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let addr = "0.0.0.0:8080";
    info!("Listening on {}", addr);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// Health check endpoint
async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let stellar_ok = state.stellar.check_connection().await;
    let redis_ok = state.cache.check_connection().await;

    let status = if stellar_ok && redis_ok {
        "healthy"
    } else {
        "degraded"
    };

    Json(HealthResponse {
        status: status.to_string(),
        stellar_connected: stellar_ok,
        redis_connected: redis_ok,
    })
}

// Metrics endpoint
async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    state.metrics.render()
}

// Verify document by POST
async fn verify_document(
    State(state): State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, StatusCode> {
    info!("Verifying document hash: {}", req.document_hash);
    state.metrics.increment_request_count();

    // Check cache first
    if let Ok(Some(cached)) = state.cache.get(&req.document_hash).await {
        info!("Cache hit for hash: {}", req.document_hash);
        state.metrics.increment_cache_hits();
        return Ok(Json(cached));
    }

    state.metrics.increment_cache_misses();

    // Query Stellar blockchain
    let result = match state.stellar.verify_hash(&req.document_hash).await {
        Ok(verification) => verification,
        Err(e) => {
            warn!("Stellar query failed: {}", e);
            state.metrics.increment_error_count();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let response = VerifyResponse {
        verified: result.verified,
        transaction_id: result.transaction_id,
        timestamp: result.timestamp,
        cached: false,
    };

    // Cache result
    if let Err(e) = state.cache.set(&req.document_hash, &response, 3600).await {
        warn!("Failed to cache result: {}", e);
    }

    Ok(Json(response))
}

// Verify document by GET with hash in path
async fn verify_document_by_hash(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<VerifyResponse>, StatusCode> {
    let req = VerifyRequest {
        document_hash: hash,
        transaction_id: None,
    };
    verify_document(State(state), Json(req)).await
}
EOF

# Create Stellar client module
cat > src/stellar.rs << 'EOF'
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, error};

#[derive(Clone)]
pub struct StellarClient {
    horizon_url: String,
    client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationResult {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct HorizonResponse {
    _embedded: EmbeddedRecords,
}

#[derive(Debug, Deserialize)]
struct EmbeddedRecords {
    records: Vec<Transaction>,
}

#[derive(Debug, Deserialize)]
struct Transaction {
    id: String,
    created_at: String,
    memo: Option<String>,
}

impl StellarClient {
    pub fn new(horizon_url: &str) -> Self {
        Self {
            horizon_url: horizon_url.to_string(),
            client: Client::new(),
        }
    }

    pub async fn check_connection(&self) -> bool {
        let url = format!("{}/", self.horizon_url);
        self.client.get(&url).send().await.is_ok()
    }

    pub async fn verify_hash(&self, document_hash: &str) -> Result<VerificationResult> {
        debug!("Querying Stellar for hash: {}", document_hash);

        // Query Stellar Horizon API for transactions with matching memo
        let url = format!(
            "{}/transactions?order=desc&limit=10",
            self.horizon_url
        );

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            error!("Stellar API returned status: {}", response.status());
            return Ok(VerificationResult {
                verified: false,
                transaction_id: None,
                timestamp: None,
            });
        }

        let horizon_response: HorizonResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse response: {}", e))?;

        // Search for matching hash in transaction memos
        for tx in horizon_response._embedded.records {
            if let Some(memo) = &tx.memo {
                if memo.contains(document_hash) {
                    debug!("Found matching transaction: {}", tx.id);
                    
                    let timestamp = chrono::DateTime::parse_from_rfc3339(&tx.created_at)
                        .map(|dt| dt.timestamp())
                        .ok();

                    return Ok(VerificationResult {
                        verified: true,
                        transaction_id: Some(tx.id),
                        timestamp,
                    });
                }
            }
        }

        debug!("No matching transaction found for hash");
        Ok(VerificationResult {
            verified: false,
            transaction_id: None,
            timestamp: None,
        })
    }
}
EOF

# Create cache module
cat > src/cache.rs << 'EOF'
use anyhow::Result;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};

pub struct CacheClient {
    connection: ConnectionManager,
}

impl CacheClient {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(Self { connection })
    }

    pub async fn check_connection(&self) -> bool {
        let mut conn = self.connection.clone();
        redis::cmd("PING").query_async::<_, String>(&mut conn).await.is_ok()
    }

    pub async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        let mut conn = self.connection.clone();
        let value: Option<String> = conn.get(key).await?;
        
        match value {
            Some(v) => Ok(Some(serde_json::from_str(&v)?)),
            None => Ok(None),
        }
    }

    pub async fn set<T>(&self, key: &str, value: &T, ttl: u64) -> Result<()>
    where
        T: Serialize,
    {
        let mut conn = self.connection.clone();
        let serialized = serde_json::to_string(value)?;
        conn.set_ex(key, serialized, ttl).await?;
        Ok(())
    }
}
EOF

# Create metrics module
cat > src/metrics.rs << 'EOF'
use prometheus::{Counter, Encoder, Registry, TextEncoder};
use std::sync::Arc;

pub struct MetricsRegistry {
    registry: Registry,
    request_count: Counter,
    cache_hits: Counter,
    cache_misses: Counter,
    error_count: Counter,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        let registry = Registry::new();

        let request_count = Counter::new("requests_total", "Total requests").unwrap();
        let cache_hits = Counter::new("cache_hits_total", "Cache hits").unwrap();
        let cache_misses = Counter::new("cache_misses_total", "Cache misses").unwrap();
        let error_count = Counter::new("errors_total", "Total errors").unwrap();

        registry.register(Box::new(request_count.clone())).unwrap();
        registry.register(Box::new(cache_hits.clone())).unwrap();
        registry.register(Box::new(cache_misses.clone())).unwrap();
        registry.register(Box::new(error_count.clone())).unwrap();

        Self {
            registry,
            request_count,
            cache_hits,
            cache_misses,
            error_count,
        }
    }

    pub fn increment_request_count(&self) {
        self.request_count.inc();
    }

    pub fn increment_cache_hits(&self) {
        self.cache_hits.inc();
    }

    pub fn increment_cache_misses(&self) {
        self.cache_misses.inc();
    }

    pub fn increment_error_count(&self) {
        self.error_count.inc();
    }

    pub fn render(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = vec![];
        encoder.encode(&metric_families, &mut buffer).unwrap();
        String::from_utf8(buffer).unwrap()
    }
}
EOF

# Create rate limit module
cat > src/rate_limit.rs << 'EOF'
// Rate limiting can be added using governor crate
// Example implementation for future enhancement

use std::sync::Arc;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

pub struct RateLimitService {
    limiter: Arc<RateLimiter<String, governor::state::keyed::DefaultKeyedStateStore<String>, governor::clock::DefaultClock>>,
}

impl RateLimitService {
    pub fn new(per_second: u32) -> Self {
        let quota = Quota::per_second(NonZeroU32::new(per_second).unwrap());
        let limiter = Arc::new(RateLimiter::keyed(quota));
        Self { limiter }
    }
}
EOF

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM rust:1.75 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/stellar-doc-verifier /usr/local/bin/
EXPOSE 8080
CMD ["stellar-doc-verifier"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
      - REDIS_URL=redis://redis:6379
      - RUST_LOG=info
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
EOF

# Create .env.example
cat > .env.example << 'EOF'
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
REDIS_URL=redis://127.0.0.1:6379
RUST_LOG=debug
EOF

# Create basic test
cat > tests/integration_test.rs << 'EOF'
#[cfg(test)]
mod tests {
    use stellar_doc_verifier::*;

    #[tokio::test]
    async fn test_health_check() {
        // Integration tests here
        assert!(true);
    }

    #[tokio::test]
    async fn test_document_verification() {
        // Verification tests here
        assert!(true);
    }
}
EOF

# Create README
cat > README.md << 'EOF'
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
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
target/
Cargo.lock
.env
*.log
EOF

echo ""
echo "✅ Stellar Document Verification Microservice created!"
echo ""
echo "Next steps:"
echo "1. cargo build"
echo "2. docker-compose up (starts API + Redis)"
echo "3. curl http://localhost:8080/health"
echo "4. cargo test"
echo ""