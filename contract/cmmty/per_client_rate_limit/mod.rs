//! Per-client configurable rate limiting (SC-12).
//!
//! Reads `X-Client-Id` from each request and applies either a "known-client"
//! limit or a default limit, both configured via environment variables.
//! Per-client counters are stored in Redis (or an in-memory fallback for tests).
//!
//! Response headers set on every request:
//!   `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

pub mod config;

use axum::{body::Body, extract::Request, http::HeaderValue, response::Response};
use futures::future::BoxFuture;
use std::{
    sync::Arc,
    task::{Context, Poll},
    time::{SystemTime, UNIX_EPOCH},
};
use tower::{Layer, Service};

pub use config::RateLimitConfig;
use config::ClientTier;

// ── Redis counter store ───────────────────────────────────────────────────────

/// Minimal async counter backed by Redis (or in-memory for tests).
#[async_trait::async_trait]
pub trait CounterStore: Send + Sync {
    /// Increment the counter for `key` and return (new_count, window_reset_unix_secs).
    /// The window is `window_secs` seconds wide.
    async fn increment(&self, key: &str, window_secs: u64) -> anyhow::Result<(u64, u64)>;
}

/// Redis-backed counter store.
pub struct RedisCounterStore {
    client: redis::Client,
}

impl RedisCounterStore {
    pub fn new(redis_url: &str) -> anyhow::Result<Self> {
        Ok(Self {
            client: redis::Client::open(redis_url)?,
        })
    }
}

#[async_trait::async_trait]
impl CounterStore for RedisCounterStore {
    async fn increment(&self, key: &str, window_secs: u64) -> anyhow::Result<(u64, u64)> {
        use redis::AsyncCommands;
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let count: u64 = conn.incr(key, 1u64).await?;
        if count == 1 {
            conn.expire(key, window_secs as i64).await?;
        }
        let ttl: i64 = conn.ttl(key).await?;
        let reset = now_unix() + ttl.max(0) as u64;
        Ok((count, reset))
    }
}

/// In-memory counter store (for tests / no-Redis environments).
#[derive(Default)]
pub struct InMemoryCounterStore {
    store: Arc<tokio::sync::Mutex<std::collections::HashMap<String, (u64, u64)>>>,
}

#[async_trait::async_trait]
impl CounterStore for InMemoryCounterStore {
    async fn increment(&self, key: &str, window_secs: u64) -> anyhow::Result<(u64, u64)> {
        let mut map = self.store.lock().await;
        let now = now_unix();
        let entry = map.entry(key.to_string()).or_insert((0, now + window_secs));
        // Reset window if expired
        if now >= entry.1 {
            *entry = (0, now + window_secs);
        }
        entry.0 += 1;
        Ok((entry.0, entry.1))
    }
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ── Tower layer ───────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct PerClientRateLimitLayer {
    config: Arc<RateLimitConfig>,
    store: Arc<dyn CounterStore>,
}

impl PerClientRateLimitLayer {
    pub fn new(config: RateLimitConfig, store: Arc<dyn CounterStore>) -> Self {
        Self {
            config: Arc::new(config),
            store,
        }
    }
}

impl<S> Layer<S> for PerClientRateLimitLayer {
    type Service = PerClientRateLimitMiddleware<S>;
    fn layer(&self, inner: S) -> Self::Service {
        PerClientRateLimitMiddleware {
            inner,
            config: self.config.clone(),
            store: self.store.clone(),
        }
    }
}

#[derive(Clone)]
pub struct PerClientRateLimitMiddleware<S> {
    inner: S,
    config: Arc<RateLimitConfig>,
    store: Arc<dyn CounterStore>,
}

impl<S> Service<Request<Body>> for PerClientRateLimitMiddleware<S>
where
    S: Service<Request<Body>, Response = Response> + Send + Clone + 'static,
    S::Future: Send + 'static,
    S::Error: Into<Box<dyn std::error::Error + Send + Sync>>,
{
    type Response = Response;
    type Error = S::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let client_id = req
            .headers()
            .get("x-client-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("anonymous")
            .to_string();

        let tier = self.config.tier_for(&client_id);
        let limit = match tier {
            ClientTier::Known => self.config.known_client_limit,
            ClientTier::Default => self.config.default_limit,
        };
        let window = self.config.window_secs;
        let counter_key = format!("rl:{}", client_id);

        let store = self.store.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let (count, reset) = store
                .increment(&counter_key, window)
                .await
                .unwrap_or((limit + 1, now_unix() + window)); // fail-open: deny on store error

            let remaining = limit.saturating_sub(count);

            if count > limit {
                let mut resp = Response::builder()
                    .status(axum::http::StatusCode::TOO_MANY_REQUESTS)
                    .body(Body::from("rate limit exceeded"))
                    .unwrap();
                set_rl_headers(resp.headers_mut(), limit, 0, reset);
                return Ok(resp);
            }

            let result = inner.call(req).await?;
            let mut resp = result;
            set_rl_headers(resp.headers_mut(), limit, remaining, reset);
            Ok(resp)
        })
    }
}

fn set_rl_headers(
    headers: &mut axum::http::HeaderMap,
    limit: u64,
    remaining: u64,
    reset: u64,
) {
    headers.insert(
        "x-ratelimit-limit",
        HeaderValue::from_str(&limit.to_string()).unwrap(),
    );
    headers.insert(
        "x-ratelimit-remaining",
        HeaderValue::from_str(&remaining.to_string()).unwrap(),
    );
    headers.insert(
        "x-ratelimit-reset",
        HeaderValue::from_str(&reset.to_string()).unwrap(),
    );
}

// ── unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, routing::get, Router};
    use tower::ServiceExt;

    fn make_layer() -> PerClientRateLimitLayer {
        let cfg = RateLimitConfig {
            default_limit: 3,
            known_client_limit: 10,
            window_secs: 60,
            known_clients: vec!["vip-client".to_string()],
        };
        let store = Arc::new(InMemoryCounterStore::default());
        PerClientRateLimitLayer::new(cfg, store)
    }

    fn app_with_layer(layer: PerClientRateLimitLayer) -> Router {
        Router::new()
            .route("/", get(|| async { "ok" }))
            .layer(layer)
    }

    async fn send(app: Router, client_id: Option<&str>) -> axum::http::StatusCode {
        let mut builder = Request::builder().uri("/");
        if let Some(id) = client_id {
            builder = builder.header("x-client-id", id);
        }
        let req = builder.body(Body::empty()).unwrap();
        app.oneshot(req).await.unwrap().status()
    }

    #[tokio::test]
    async fn default_client_allowed_within_limit() {
        let app = app_with_layer(make_layer());
        let status = send(app, Some("unknown-client")).await;
        assert_eq!(status, axum::http::StatusCode::OK);
    }

    #[tokio::test]
    async fn default_client_blocked_after_limit() {
        let store = Arc::new(InMemoryCounterStore::default());
        let cfg = RateLimitConfig {
            default_limit: 2,
            known_client_limit: 100,
            window_secs: 60,
            known_clients: vec![],
        };
        let layer = PerClientRateLimitLayer::new(cfg, store);

        // Share the same store across requests by building the router once
        let router = Router::new()
            .route("/", get(|| async { "ok" }))
            .layer(layer);

        // First two requests should pass
        for _ in 0..2 {
            let req = Request::builder()
                .uri("/")
                .header("x-client-id", "test-client")
                .body(Body::empty())
                .unwrap();
            let status = router.clone().oneshot(req).await.unwrap().status();
            assert_eq!(status, axum::http::StatusCode::OK);
        }

        // Third request should be rate-limited
        let req = Request::builder()
            .uri("/")
            .header("x-client-id", "test-client")
            .body(Body::empty())
            .unwrap();
        let status = router.clone().oneshot(req).await.unwrap().status();
        assert_eq!(status, axum::http::StatusCode::TOO_MANY_REQUESTS);
    }

    #[tokio::test]
    async fn known_client_gets_higher_limit() {
        let cfg = RateLimitConfig {
            default_limit: 1,
            known_client_limit: 100,
            window_secs: 60,
            known_clients: vec!["vip".to_string()],
        };
        assert_eq!(cfg.tier_for("vip"), ClientTier::Known);
        assert_eq!(cfg.tier_for("other"), ClientTier::Default);
    }

    #[tokio::test]
    async fn response_includes_ratelimit_headers() {
        let app = app_with_layer(make_layer());
        let req = Request::builder()
            .uri("/")
            .header("x-client-id", "header-test")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert!(resp.headers().contains_key("x-ratelimit-limit"));
        assert!(resp.headers().contains_key("x-ratelimit-remaining"));
        assert!(resp.headers().contains_key("x-ratelimit-reset"));
    }

    #[tokio::test]
    async fn anonymous_client_uses_default_limit() {
        let app = app_with_layer(make_layer());
        let status = send(app, None).await;
        assert_eq!(status, axum::http::StatusCode::OK);
    }
}
