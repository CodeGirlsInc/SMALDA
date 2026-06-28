use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::{json, Value};
use std::sync::Arc;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::module::webhook::VerificationWebhookNotifier;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{app, AppState, RevokeResponse};

fn create_test_state() -> AppState {
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

fn valid_hash() -> &'static str {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

#[tokio::test]
async fn test_valid_revocation_returns_200_with_transaction_id_and_revoked_at() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/revoke")
        .json(&json!({
            "document_hash": valid_hash(),
            "reason": "document compromised",
            "revoked_by": "admin"
        }))
        .await;

    response.assert_status_ok();
    let body: RevokeResponse = response.json();
    assert!(!body.transaction_id.is_empty());
    assert!(body.revoked_at > 0);
}

#[tokio::test]
async fn test_revoking_already_revoked_hash_returns_409() {
    let state = create_test_state();

    // Pre-seed revocation flag in cache
    let revoked_key = format!("revoked:{}", valid_hash());
    state
        .cache
        .set(&revoked_key, &true, u64::MAX / 2)
        .await
        .unwrap();

    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/revoke")
        .json(&json!({
            "document_hash": valid_hash(),
            "reason": "duplicate revoke",
            "revoked_by": "admin"
        }))
        .await;

    assert_eq!(response.status_code(), StatusCode::CONFLICT);
    let body: Value = response.json();
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn test_invalid_hash_format_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/revoke")
        .json(&json!({
            "document_hash": "not-a-valid-hash",
            "reason": "test",
            "revoked_by": "admin"
        }))
        .await;

    response.assert_status_bad_request();
    let body: Value = response.json();
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn test_missing_reason_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/revoke")
        .json(&json!({
            "document_hash": valid_hash(),
            "revoked_by": "admin"
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_missing_revoked_by_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/revoke")
        .json(&json!({
            "document_hash": valid_hash(),
            "reason": "test reason"
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_stellar_failure_returns_500() {
    let stellar = Arc::new(StellarClient::new("http://127.0.0.1:1"));
    let cache = Arc::new(CacheBackend::InMemory(InMemoryCache::new()));
    let metrics = Arc::new(MetricsRegistry::new());
    let notifier = Arc::new(VerificationWebhookNotifier::new());

    let state = AppState {
        stellar,
        cache,
        metrics,
        stellar_secret_key: "test_secret".to_string(),
        notifier,
    };

    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/revoke")
        .json(&json!({
            "document_hash": valid_hash(),
            "reason": "test",
            "revoked_by": "admin"
        }))
        .await;

    assert_eq!(response.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
}