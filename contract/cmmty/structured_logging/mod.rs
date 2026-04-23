//! Structured JSON logging middleware (SC-11).
//!
//! Provides:
//! - `init_json_logging()` — initialise tracing-subscriber with JSON output.
//! - `LoggingLayer` / `LoggingMiddleware` — Axum-compatible Tower middleware
//!   that emits one JSON log line per request containing:
//!   `timestamp`, `method`, `path`, `status_code`, `duration_ms`, `request_id`.
//! - `log_stellar_op()` — helper for Stellar interaction log lines.

pub mod config;

use axum::{body::Body, extract::Request, response::Response};
use futures::future::BoxFuture;
use std::{
    task::{Context, Poll},
    time::Instant,
};
use tower::{Layer, Service};
use tracing::{error, info};
use uuid::Uuid;

pub use config::LogConfig;

/// Initialise a global tracing subscriber that emits JSON to stdout.
/// Call once at application startup.
pub fn init_json_logging(config: &LogConfig) {
    use tracing_subscriber::{fmt, EnvFilter};

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&config.log_level));

    fmt()
        .json()
        .with_env_filter(filter)
        .with_current_span(false)
        .init();
}

// ── Tower layer ───────────────────────────────────────────────────────────────

#[derive(Clone, Default)]
pub struct LoggingLayer;

impl<S> Layer<S> for LoggingLayer {
    type Service = LoggingMiddleware<S>;
    fn layer(&self, inner: S) -> Self::Service {
        LoggingMiddleware { inner }
    }
}

#[derive(Clone)]
pub struct LoggingMiddleware<S> {
    inner: S,
}

impl<S> Service<Request<Body>> for LoggingMiddleware<S>
where
    S: Service<Request<Body>, Response = Response> + Send + Clone + 'static,
    S::Future: Send + 'static,
    S::Error: std::fmt::Debug,
{
    type Response = Response;
    type Error = S::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let method = req.method().to_string();
        let path = req.uri().path().to_string();
        let request_id = Uuid::new_v4().to_string();
        let start = Instant::now();

        let mut inner = self.inner.clone();
        Box::pin(async move {
            let result = inner.call(req).await;
            let duration_ms = start.elapsed().as_millis();

            match &result {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    info!(
                        timestamp = %chrono::Utc::now().to_rfc3339(),
                        method = %method,
                        path = %path,
                        status_code = status,
                        duration_ms = duration_ms,
                        request_id = %request_id,
                        "request completed"
                    );
                }
                Err(e) => {
                    error!(
                        timestamp = %chrono::Utc::now().to_rfc3339(),
                        method = %method,
                        path = %path,
                        duration_ms = duration_ms,
                        request_id = %request_id,
                        error = ?e,
                        "request error"
                    );
                }
            }

            result
        })
    }
}

// ── Stellar interaction logger ────────────────────────────────────────────────

/// Log a Stellar operation result.
///
/// - `operation`: e.g. `"verify_hash"`, `"anchor_transfer"`
/// - `hash`: full hash string — will be truncated to 16 chars in the log
/// - `success`: whether the operation succeeded
/// - `ledger`: ledger sequence number on success, `None` otherwise
pub fn log_stellar_op(operation: &str, hash: &str, success: bool, ledger: Option<u64>) {
    let truncated = &hash[..hash.len().min(16)];
    if success {
        info!(
            timestamp = %chrono::Utc::now().to_rfc3339(),
            operation = %operation,
            hash = %truncated,
            success = true,
            ledger = ledger,
            "stellar operation succeeded"
        );
    } else {
        error!(
            timestamp = %chrono::Utc::now().to_rfc3339(),
            operation = %operation,
            hash = %truncated,
            success = false,
            "stellar operation failed"
        );
    }
}

// ── unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, routing::get, Router};
    use tower::ServiceExt;

    fn test_router() -> Router {
        Router::new()
            .route("/ping", get(|| async { "pong" }))
            .layer(LoggingLayer)
    }

    #[tokio::test]
    async fn middleware_passes_request_through() {
        let app = test_router();
        let req = Request::builder()
            .uri("/ping")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), axum::http::StatusCode::OK);
    }

    #[tokio::test]
    async fn middleware_returns_404_for_unknown_route() {
        let app = test_router();
        let req = Request::builder()
            .uri("/unknown")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), axum::http::StatusCode::NOT_FOUND);
    }

    #[test]
    fn log_stellar_op_truncates_hash() {
        // Just verify it doesn't panic with a short or long hash
        log_stellar_op("verify_hash", "abcdef1234567890abcdef", true, Some(12345));
        log_stellar_op("anchor_transfer", "short", false, None);
    }

    #[test]
    fn log_config_defaults() {
        let cfg = LogConfig::default();
        assert_eq!(cfg.log_level, "info");
    }
}
