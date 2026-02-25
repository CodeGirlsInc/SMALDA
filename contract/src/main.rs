use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;
use stellar_doc_verifier::*;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::cache::{CacheBackend, RedisCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::config::AppConfig;
use stellar_doc_verifier::app; // Assuming app function is made public in lib.rs

// Request/Response types
#[derive(Debug, Deserialize)]
struct VerifyRequest {
    document_hash: String,
    transaction_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
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
    // Load configuration
    let config = AppConfig::from_env()?;

    // Initialize tracing
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new(format!(
            "stellar_doc_verifier={},tower_http={}",
            config.log_level, config.log_level
        ))
    });

    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    info!("Starting Stellar Document Verification Service");

    // Startup configuration summary (redacting secrets)
    info!(
        "Configuration: port={}, stellar_horizon_url={}, redis_url={}, rate_limit_per_second={}, rate_limit_burst={}, stellar_max_retries={}, log_level={}, webhook_urls={:?}, stellar_secret_key=[REDACTED], webhook_secret=[REDACTED], cache_verification_ttl={}",
        config.port,
        config.stellar_horizon_url,
        config.redis_url,
        config.rate_limit_per_second,
        config.rate_limit_burst,
        config.stellar_max_retries,
        config.log_level,
        config.webhook_urls,
        config.cache_verification_ttl,
    );

    // Initialize components
    let stellar_url = config.stellar_horizon_url.clone();
    let redis_url = config.redis_url.clone();

    let stellar = Arc::new(StellarClient::new(&stellar_url));
    let cache = Arc::new(CacheBackend::Redis(RedisCache::new(&redis_url).await?));
    let metrics = Arc::new(MetricsRegistry::new());

    let state = AppState {
        stellar,
        cache,
        metrics,
        stellar_secret_key: config.stellar_secret_key.clone().unwrap_or_default(),
    };

    let app = app(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    info!("Listening on {}", addr);
    let listener = TcpListener::bind(&addr).await?;
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
