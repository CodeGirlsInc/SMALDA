//! Health and readiness endpoints for the stellar-doc-verifier service.
//!
//! * `GET /health/live`  — liveness: returns 200 whenever the process runs.
//!   No dependency checks; safe to call at any frequency.
//!
//! * `GET /health/ready` — readiness: checks Redis and Horizon reachability.
//!   Returns 200 when all dependencies are healthy, 503 naming every failed
//!   dependency so orchestrators can diagnose failures quickly.
//!
//! The Horizon reachability result is cached for [`HORIZON_CACHE_TTL_SECS`]
//! seconds so that health-poll traffic does not generate real Horizon load.
//!
//! Both endpoints are excluded from rate limiting (see [`app`](crate::app)).

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::Instant;

use crate::AppState;

// ---------------------------------------------------------------------------
// Horizon reachability cache
// ---------------------------------------------------------------------------

/// How long (seconds) to cache the Horizon reachability result.
const HORIZON_CACHE_TTL_SECS: u64 = 10;

struct CachedBool {
    value: bool,
    fetched_at: Instant,
}

static HORIZON_CACHE: Lazy<Arc<RwLock<Option<CachedBool>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

/// Return Horizon reachability, using the cache when fresh enough.
async fn horizon_reachable(state: &AppState) -> bool {
    // Fast path: read lock only
    {
        let guard = HORIZON_CACHE.read().await;
        if let Some(ref cached) = *guard {
            if cached.fetched_at.elapsed().as_secs() < HORIZON_CACHE_TTL_SECS {
                return cached.value;
            }
        }
    }

    // Slow path: refresh
    let fresh = state.stellar.check_connection().await;
    let mut guard = HORIZON_CACHE.write().await;
    *guard = Some(CachedBool {
        value: fresh,
        fetched_at: Instant::now(),
    });
    fresh
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Body returned by `GET /health/live`.
#[derive(Debug, Serialize)]
pub struct LiveResponse {
    pub status: &'static str,
}

/// Per-dependency status reported in the readiness response.
#[derive(Debug, Serialize)]
pub struct DependencyStatus {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<&'static str>,
}

/// Body returned by `GET /health/ready`.
#[derive(Debug, Serialize)]
pub struct ReadyResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub stellar_network: String,
    pub dependencies: ReadyDeps,
}

#[derive(Debug, Serialize)]
pub struct ReadyDeps {
    pub redis: DependencyStatus,
    pub horizon: DependencyStatus,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /health/live` — always 200 when the process is running.
pub async fn health_live() -> impl IntoResponse {
    Json(LiveResponse { status: "ok" })
}

/// `GET /health/ready` — 200 when all deps are healthy, 503 otherwise.
pub async fn health_ready(State(state): State<AppState>) -> Response {
    let redis_ok = state.cache.check_connection().await;
    let horizon_ok = horizon_reachable(&state).await;

    let stellar_network = if state
        .stellar
        .horizon_url()
        .contains("testnet")
    {
        "testnet".to_string()
    } else {
        "mainnet".to_string()
    };

    let all_ok = redis_ok && horizon_ok;
    let http_status = if all_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let body = ReadyResponse {
        status: if all_ok { "ready" } else { "degraded" },
        version: env!("CARGO_PKG_VERSION"),
        stellar_network,
        dependencies: ReadyDeps {
            redis: DependencyStatus {
                ok: redis_ok,
                error: if redis_ok {
                    None
                } else {
                    Some("redis unreachable")
                },
            },
            horizon: DependencyStatus {
                ok: horizon_ok,
                error: if horizon_ok {
                    None
                } else {
                    Some("horizon unreachable")
                },
            },
        },
    };

    (http_status, Json(body)).into_response()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::get, Router};
    use axum_test::TestServer;
    use std::sync::Arc;

    use crate::{
        cache::{CacheBackend, InMemoryCache},
        metrics::MetricsRegistry,
        rate_limit::build_rate_limiter,
        stellar::StellarClient,
        AppState,
    };

    fn make_state(horizon_url: &str) -> AppState {
        AppState {
            stellar: Arc::new(StellarClient::new(horizon_url)),
            cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
            metrics: Arc::new(MetricsRegistry::new()),
            stellar_secret_key: String::new(),
            rate_limiter: build_rate_limiter(1000, 1000),
            webhook_urls: Vec::new(),
            webhook_secret: None,
        }
    }

    fn test_router(state: AppState) -> Router {
        Router::new()
            .route("/health/live", get(health_live))
            .route("/health/ready", get(health_ready))
            .with_state(state)
    }

    #[tokio::test]
    async fn live_returns_200_always() {
        let state = make_state("http://127.0.0.1:1"); // unreachable horizon
        let server = TestServer::new(test_router(state)).unwrap();
        let resp = server.get("/health/live").await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert_eq!(body["status"], "ok");
    }

    #[tokio::test]
    async fn ready_returns_503_when_horizon_down() {
        // Use an address that will refuse connections immediately.
        let state = make_state("http://127.0.0.1:1");
        let server = TestServer::new(test_router(state)).unwrap();
        let resp = server.get("/health/ready").await;
        resp.assert_status(StatusCode::SERVICE_UNAVAILABLE);
        let body: serde_json::Value = resp.json();
        assert_eq!(body["status"], "degraded");
        assert_eq!(body["dependencies"]["horizon"]["ok"], false);
        // Names the failed dependency
        assert!(body["dependencies"]["horizon"]["error"]
            .as_str()
            .unwrap_or("")
            .contains("horizon"));
    }

    #[tokio::test]
    async fn ready_response_includes_version_and_network() {
        let state = make_state("http://127.0.0.1:1");
        let server = TestServer::new(test_router(state)).unwrap();
        let resp = server.get("/health/ready").await;
        let body: serde_json::Value = resp.json();
        // version field must be present and non-empty
        assert!(!body["version"].as_str().unwrap_or("").is_empty());
        // stellar_network must be one of the known values
        let net = body["stellar_network"].as_str().unwrap_or("");
        assert!(net == "testnet" || net == "mainnet");
    }
}
