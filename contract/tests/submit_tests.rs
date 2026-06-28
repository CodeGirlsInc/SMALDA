use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::{json, Value};
use std::sync::Arc;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::module::webhook::VerificationWebhookNotifier;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{app, AppState};

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
async fn test_valid_hash_returns_200_with_success_and_transaction_id() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/submit")
        .json(&json!({
            "document_hash": valid_hash(),
            "document_id": "doc-001",
            "submitter": "alice"
        }))
        .await;

    response.assert_status_ok();
    let body: Value = response.json();
    assert_eq!(body["success"], true);
    assert!(body["transaction_id"].as_str().is_some());
}

#[tokio::test]
async fn test_hash_shorter_than_64_chars_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/submit")
        .json(&json!({
            "document_hash": "abc123",
            "document_id": "doc-001",
            "submitter": "alice"
        }))
        .await;

    response.assert_status_bad_request();
    let body: Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("wrong length"));
}

#[tokio::test]
async fn test_non_hex_characters_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    // 64 chars but with non-hex 'z'
    let bad_hash = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
    let response = server
        .post("/submit")
        .json(&json!({
            "document_hash": bad_hash,
            "document_id": "doc-001",
            "submitter": "alice"
        }))
        .await;

    response.assert_status_bad_request();
    let body: Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("invalid character"));
}

#[tokio::test]
async fn test_empty_document_hash_returns_400() {
    let state = create_test_state();
    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/submit")
        .json(&json!({
            "document_hash": "",
            "document_id": "doc-001",
            "submitter": "alice"
        }))
        .await;

    response.assert_status_bad_request();
    let body: Value = response.json();
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn test_duplicate_hash_returns_409() {
    let state = create_test_state();

    // Pre-seed cache to simulate already submitted
    let submit_key = format!("submit:{}", valid_hash());
    state
        .cache
        .set_raw(&submit_key, r#"{"tx_hash":"0xabc","anchored_at":1}"#, 3600)
        .await
        .unwrap();

    let server = TestServer::new(app(state)).unwrap();

    let response = server
        .post("/submit")
        .json(&json!({
            "document_hash": valid_hash(),
            "document_id": "doc-001",
            "submitter": "alice"
        }))
        .await;

    assert_eq!(response.status_code(), StatusCode::CONFLICT);
    let body: Value = response.json();
    assert!(body["error"].as_str().unwrap().to_lowercase().contains("already"));
}

#[tokio::test]
async fn test_stellar_client_failure_returns_500() {
    // Point to a broken Stellar URL to force anchor failure
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
        .post("/submit")
        .json(&json!({
            "document_hash": valid_hash(),
            "document_id": "doc-001",
            "submitter": "alice"
        }))
        .await;

    assert_eq!(response.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
}