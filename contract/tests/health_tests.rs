use axum_test::TestServer;
use std::sync::Arc;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::module::webhook::VerificationWebhookNotifier;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{app, AppState, HealthResponse};

fn healthy_state() -> AppState {
    let stellar = Arc::new(StellarClient::new("https://horizon-testnet.stellar.org"));
    let cache = Arc::new(CacheBackend::InMemory(InMemoryCache::new()));
    let metrics = Arc::new(MetricsRegistry::new());
    let notifier = Arc::new(VerificationWebhookNotifier::new());

    AppState {
        stellar,
        cache,
        metrics,
        stellar_secret_key: "test_secret".to_string(),
        notifier,
    }
}

fn broken_stellar_state() -> AppState {
    // 127.0.0.1:1 refuses connections so check_connection() returns false.
    let stellar = Arc::new(StellarClient::new("http://127.0.0.1:1"));
    let cache = Arc::new(CacheBackend::InMemory(InMemoryCache::new()));
    let metrics = Arc::new(MetricsRegistry::new());
    let notifier = Arc::new(VerificationWebhookNotifier::new());

    AppState {
        stellar,
        cache,
        metrics,
        stellar_secret_key: "test_secret".to_string(),
        notifier,
    }
}

#[tokio::test]
async fn test_health_returns_200_when_both_connections_ok() {
    let state = healthy_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server.get("/health").await;
    response.assert_status_ok();

    let body: HealthResponse = response.json();
    assert_eq!(body.status, "healthy");
    assert!(body.stellar_connected);
    assert!(body.redis_connected);
}

#[tokio::test]
async fn test_health_returns_200_with_degraded_when_stellar_unreachable() {
    let state = broken_stellar_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server.get("/health").await;
    response.assert_status_ok();

    let body: HealthResponse = response.json();
    assert_eq!(body.status, "degraded");
    assert!(!body.stellar_connected);
    // InMemoryCache reports healthy even without real Redis connectivity.
    assert!(body.redis_connected);
}

#[tokio::test]
async fn test_health_response_shape_includes_required_fields() {
    let state = healthy_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server.get("/health").await;
    response.assert_status_ok();

    let json: serde_json::Value = response.json();
    assert!(json.get("status").is_some(), "missing 'status' field");
    assert!(
        json.get("stellar_connected").is_some(),
        "missing 'stellar_connected' field"
    );
    assert!(
        json.get("redis_connected").is_some(),
        "missing 'redis_connected' field"
    );
}

#[tokio::test]
async fn test_health_endpoint_is_idempotent() {
    let state = healthy_state();
    let server = TestServer::new(app(state)).unwrap();

    // Hitting the endpoint multiple times should always return the same shape.
    for _ in 0..3 {
        let response = server.get("/health").await;
        response.assert_status_ok();
        let body: HealthResponse = response.json();
        assert!(body.stellar_connected);
        assert!(body.redis_connected);
    }
}
