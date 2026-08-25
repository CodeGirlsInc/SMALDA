//! Integration tests for the wired rate limiter (CT-37).
//!
//! `build_rate_limiter` is constructed from `RATE_LIMIT_PER_SECOND` /
//! `RATE_LIMIT_BURST` in `main.rs`, stored on `AppState`, and enforced as a
//! router middleware. These tests drive the real `app()` router and assert
//! that a `429 Too Many Requests` is returned once the burst quota is
//! exceeded.

use axum_test::TestServer;
use std::sync::Arc;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::rate_limit::build_rate_limiter;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::AppState;

fn test_state(burst: u32) -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new("https://horizon-testnet.stellar.org")),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string(),
        rate_limiter: build_rate_limiter(10, burst),
    }
}

#[tokio::test]
async fn requests_within_burst_are_allowed() {
    let server = TestServer::new(app(test_state(5))).unwrap();

    for _ in 0..5 {
        let response = server.get("/metrics").await;
        assert_eq!(response.status_code(), 200);
    }
}

#[tokio::test]
async fn exceeding_the_burst_returns_429() {
    let server = TestServer::new(app(test_state(1))).unwrap();

    let first = server.get("/metrics").await;
    assert_eq!(first.status_code(), 200);

    let second = server.get("/metrics").await;
    assert_eq!(second.status_code(), 429);
    assert!(second.text().contains("rate limit exceeded"));
}

#[tokio::test]
async fn rejected_requests_hit_every_route() {
    // The limiter applies to the whole router, not a single route.
    let server = TestServer::new(app(test_state(1))).unwrap();

    // Consume the single burst token.
    assert_eq!(server.get("/metrics").await.status_code(), 200);

    // Now every route is rejected until the limiter refills.
    assert_eq!(server.get("/health").await.status_code(), 429);
}
