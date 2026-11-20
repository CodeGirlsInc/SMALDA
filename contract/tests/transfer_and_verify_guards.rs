//! Regression tests for #1670 (transfer guards) and #1672 (verify cache hit).

use serde_json::json;
use std::sync::Arc;
use axum_test::TestServer;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::rate_limit::build_rate_limiter;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{AppState, SubmitResponse, TransferRecord, VerifyResponse};

const SECRET: &str = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

fn state() -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new("http://127.0.0.1:1")),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(1000, 1000),
        submit_rate_limiter: build_rate_limiter(1000, 1000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
        metrics_token: None,
    }
}

fn transfer_body(from: &str, to: &str) -> serde_json::Value {
    json!({
        "document_hash": HASH,
        "from_owner": from,
        "to_owner": to,
        "transfer_date": "2025-01-01",
        "transfer_reference": "REF"
    })
}

async fn seed_anchor(state: &AppState) {
    let anchor = SubmitResponse {
        success: true,
        transaction_id: Some("tx1".to_string()),
        anchored_at: Some(1),
        error: None,
    };
    state
        .cache
        .set(&format!("stellar:verify:{HASH}"), &anchor, 3600)
        .await
        .unwrap();
}

#[tokio::test]
async fn transfer_of_an_unanchored_hash_returns_404() {
    let server = TestServer::new(app(state())).unwrap();
    let resp = server.post("/transfer").json(&transfer_body("A", "B")).await;
    assert_eq!(resp.status_code(), 404);
}

#[tokio::test]
async fn transfer_from_a_non_owner_returns_409() {
    let state = state();
    seed_anchor(&state).await;
    let existing = vec![TransferRecord {
        document_hash: HASH.to_string(),
        from_owner: "A".to_string(),
        to_owner: "B".to_string(),
        transfer_date: "2024-01-01".to_string(),
        transfer_reference: "R0".to_string(),
        transfer_hash: "h0".to_string(),
        memo: "m".to_string(),
        anchored_at: "2024-01-01T00:00:00Z".to_string(),
    }];
    state
        .cache
        .set(&format!("transfer:{HASH}"), &existing, 3600)
        .await
        .unwrap();

    let server = TestServer::new(app(state)).unwrap();
    // "C" does not own the document; "B" does.
    let resp = server.post("/transfer").json(&transfer_body("C", "D")).await;
    assert_eq!(resp.status_code(), 409);
}

#[tokio::test]
async fn cached_verify_with_a_wrong_transaction_id_is_not_verified() {
    let state = state();
    let cached = VerifyResponse {
        verified: true,
        transaction_id: Some("real-tx".to_string()),
        timestamp: Some(1),
        cached: false,
        revoked: Some(false),
        revoked_at: None,
    };
    state.cache.set(HASH, &cached, 3600).await.unwrap();
    let server = TestServer::new(app(state)).unwrap();

    let wrong = server
        .post("/verify")
        .json(&json!({ "document_hash": HASH, "transaction_id": "other-tx" }))
        .await;
    assert_eq!(wrong.json::<serde_json::Value>()["verified"], false);

    let right = server
        .post("/verify")
        .json(&json!({ "document_hash": HASH, "transaction_id": "real-tx" }))
        .await;
    assert_eq!(right.json::<serde_json::Value>()["verified"], true);
}
