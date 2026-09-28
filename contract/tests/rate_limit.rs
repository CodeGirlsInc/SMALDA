//! Integration tests for the wired rate limiter (CT-37).
//!
//! Configured quotas are attached to the real `app()` router. The tests cover
//! both the verification quota and the independent submit quota.

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
        submit_rate_limiter: build_rate_limiter(1, 1),
        webhook_urls: Vec::new(),
        webhook_secret: None,
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
async fn versioned_routes_are_available() {
    let server = TestServer::new(app(test_state(5))).unwrap();

    assert_eq!(server.get("/v1/metrics").await.status_code(), 200);
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
async fn non_submit_routes_share_the_verification_quota() {
    let server = TestServer::new(app(test_state(1))).unwrap();

    // Consume the single burst token.
    assert_eq!(server.get("/metrics").await.status_code(), 200);

    assert_eq!(server.get("/health").await.status_code(), 429);
}

#[tokio::test]
async fn submit_quota_is_independent_from_verification_quota() {
    let server = TestServer::new(app(test_state(1))).unwrap();
    let invalid_body = serde_json::json!({});

    let first_submit = server.post("/v1/submit").json(&invalid_body).await;
    assert_ne!(first_submit.status_code(), 429);
    assert_eq!(
        server.post("/submit").json(&invalid_body).await.status_code(),
        429
    );
    assert_eq!(server.get("/v1/metrics").await.status_code(), 200);
}
