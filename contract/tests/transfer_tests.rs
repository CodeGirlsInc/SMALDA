use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::{json, Value};
use std::sync::Arc;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::module::webhook::VerificationWebhookNotifier;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{app, AppState, TransferRequest, TransferResponse, compute_transfer_hash};

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

fn valid_transfer_body() -> serde_json::Value {
    json!({
        "document_hash": valid_hash(),
        "from_owner": "alice",
        "to_owner": "bob",
        "transfer_date": "2025-06-01",
        "transfer_reference": "REF-001"
    })
}

#[tokio::test]
async fn test_valid_transfer_returns_200_with_transfer_hash_and_memo() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server.post("/transfer").json(&valid_transfer_body()).await;

    response.assert_status_ok();
    let body: TransferResponse = response.json();
    assert!(!body.transfer_hash.is_empty());
    assert!(!body.memo.is_empty());
}

#[tokio::test]
async fn test_invalid_date_format_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/transfer")
        .json(&json!({
            "document_hash": valid_hash(),
            "from_owner": "alice",
            "to_owner": "bob",
            "transfer_date": "01-06-2025",
            "transfer_reference": "REF-001"
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_invalid_calendar_date_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/transfer")
        .json(&json!({
            "document_hash": valid_hash(),
            "from_owner": "alice",
            "to_owner": "bob",
            "transfer_date": "2025-13-01",
            "transfer_reference": "REF-001"
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_invalid_document_hash_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/transfer")
        .json(&json!({
            "document_hash": "not-valid",
            "from_owner": "alice",
            "to_owner": "bob",
            "transfer_date": "2025-06-01",
            "transfer_reference": "REF-001"
        }))
        .await;

    response.assert_status_bad_request();
    let body: Value = response.json();
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn test_transfer_of_revoked_document_returns_409() {
    let state = create_test_state();

    // Pre-seed revocation
    let revoked_key = format!("revoked:{}", valid_hash());
    state
        .cache
        .set(&revoked_key, &true, u64::MAX / 2)
        .await
        .unwrap();

    let server = TestServer::new(app(state)).unwrap();

    let response = server.post("/transfer").json(&valid_transfer_body()).await;

    assert_eq!(response.status_code(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_transfer_hash_is_deterministic() {
    let req = TransferRequest {
        document_hash: valid_hash().to_string(),
        from_owner: "alice".to_string(),
        to_owner: "bob".to_string(),
        transfer_date: "2025-06-01".to_string(),
        transfer_reference: "REF-001".to_string(),
    };

    let h1 = compute_transfer_hash(&req);
    let h2 = compute_transfer_hash(&req);
    assert_eq!(h1, h2);
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

    let response = server.post("/transfer").json(&valid_transfer_body()).await;

    assert_eq!(response.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
}