//! Integration tests for POST /revoke and the revoke-then-verify flow (CT-32).
//!
//! The revoke handler requires a prior anchor record in the cache and then
//! records the revocation on Stellar via `anchor_revocation`. The happy-path
//! test stubs Horizon with `httpmock` and asserts that a subsequent verify
//! reflects the revoked state.

use axum_test::TestServer;
use httpmock::prelude::*;
use std::sync::Arc;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::rate_limit::build_rate_limiter;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{AppState, SubmitResponse, VerifyResponse};

const SECRET: &str = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

fn valid_hash() -> String {
    "a".repeat(64)
}

fn test_state(horizon_url: &str) -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new(horizon_url)),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(100, 100),
        webhook_urls: Vec::new(),
        webhook_secret: None,
    }
}

fn revoke_body(hash: &str) -> serde_json::Value {
    serde_json::json!({
        "document_hash": hash,
        "reason": "fraudulent document",
        "revoked_by": "admin",
    })
}

#[tokio::test]
async fn revoke_with_invalid_hash_returns_400() {
    let server = TestServer::new(app(test_state("https://horizon-testnet.stellar.org"))).unwrap();

    let response = server
        .post("/revoke")
        .json(&serde_json::json!({
            "document_hash": "not-a-valid-hash",
            "reason": "test",
            "revoked_by": "admin",
        }))
        .await;

    assert_eq!(response.status_code(), 400);
}

#[tokio::test]
async fn revoke_unanchored_hash_returns_404() {
    let server = TestServer::new(app(test_state("https://horizon-testnet.stellar.org"))).unwrap();

    let response = server.post("/revoke").json(&revoke_body(&valid_hash())).await;

    assert_eq!(response.status_code(), 404);
}

#[tokio::test]
async fn revoke_then_verify_shows_revoked_state() {
    let mock_server = MockServer::start();

    // The handler passes `revoked_by` as the account used for the ManageData
    // write, so stub Horizon for that account.
    mock_server.mock(|when, then| {
        when.method(GET).path(format!("/accounts/admin"));
        then.status(200).json_body(serde_json::json!({
            "sequence": "1",
            "data": {}
        }));
    });
    let submit_mock = mock_server.mock(|when, then| {
        when.method(POST).path("/transactions");
        then.status(200).json_body(serde_json::json!({
            "hash": "txhash-revoke-123",
            "ledger": 77,
            "created_at": "2025-01-01T00:00:00Z"
        }));
    });

    let state = test_state(&mock_server.url("/"));

    // Pre-populate the anchor record the handler requires.
    let anchor = SubmitResponse {
        success: true,
        transaction_id: Some("txhash-anchor-1".to_string()),
        anchored_at: Some(1704067200),
        error: None,
    };
    state
        .cache
        .set(&format!("stellar:verify:{}", valid_hash()), &anchor, 3600)
        .await
        .unwrap();

    let server = TestServer::new(app(state.clone())).unwrap();

    let response = server.post("/revoke").json(&revoke_body(&valid_hash())).await;
    assert_eq!(response.status_code(), 200);

    let body = response.json::<serde_json::Value>();
    assert_eq!(body["transaction_id"], "txhash-revoke-123");
    assert_eq!(body["revoked"], true);
    assert!(body["revoked_at"].as_i64().is_some());
    submit_mock.assert();

    // The cached verify entry is updated to reflect the revocation, so a
    // subsequent verify reports the revoked state.
    let verify: VerifyResponse = state
        .cache
        .get(&format!("stellar:verify:{}", valid_hash()))
        .await
        .unwrap()
        .expect("revoked entry should be cached");
    assert_eq!(verify.revoked, Some(true));
    assert!(verify.revoked_at.is_some());
}

#[tokio::test]
async fn revoke_reports_stellar_failure() {
    let mock_server = MockServer::start();

    mock_server.mock(|when, then| {
        when.method(GET).path("/accounts/admin");
        then.status(200).json_body(serde_json::json!({
            "sequence": "1",
            "data": {}
        }));
    });
    mock_server.mock(|when, then| {
        when.method(POST).path("/transactions");
        then.status(500).json_body(serde_json::json!({
            "detail": "internal error"
        }));
    });

    let state = test_state(&mock_server.url("/"));
    let anchor = SubmitResponse {
        success: true,
        transaction_id: Some("txhash-anchor-1".to_string()),
        anchored_at: Some(1704067200),
        error: None,
    };
    state
        .cache
        .set(&format!("stellar:verify:{}", valid_hash()), &anchor, 3600)
        .await
        .unwrap();

    let server = TestServer::new(app(state)).unwrap();
    let response = server.post("/revoke").json(&revoke_body(&valid_hash())).await;

    assert_eq!(response.status_code(), 502);
}
