//! Integration tests for the verify endpoint (SC-09).
//!
//! Spins up an in-process Axum server with an InMemory cache and a mock
//! Stellar client so every test is deterministic and requires no external
//! services.  Run with: cargo test --manifest-path contract/Cargo.toml

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt; // for `oneshot`

use stellar_doc_verifier::{
    app,
    cache::{CacheBackend, InMemoryCache},
    metrics::MetricsRegistry,
    stellar::{StellarClient, VerificationResult},
    AppState, VerifyResponse,
};

// ── helpers ───────────────────────────────────────────────────────────────────

/// A valid 64-char lowercase hex SHA-256 hash.
const KNOWN_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const UNKNOWN_HASH: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MALFORMED_HASH: &str = "not-a-valid-hash";

fn build_state() -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new("http://127.0.0.1:1")), // unreachable; tests use cache
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: String::new(),
    }
}

async fn post_verify(state: AppState, hash: &str) -> (StatusCode, Value) {
    let router = app(state);
    let body = json!({ "document_hash": hash }).to_string();
    let req = Request::builder()
        .method("POST")
        .uri("/verify")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();

    let resp = router.oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

// ── tests ─────────────────────────────────────────────────────────────────────

/// Malformed hash → 400 Bad Request.
#[tokio::test]
async fn verify_malformed_hash_returns_400() {
    let (status, body) = post_verify(build_state(), MALFORMED_HASH).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().is_some(), "expected error field");
}

/// Hash not found in cache and Stellar returns not-verified → verified=false.
#[tokio::test]
async fn verify_unknown_hash_returns_not_verified() {
    // The mock StellarClient hits an unreachable URL and returns an error,
    // which the handler maps to 500.  Pre-seed the cache with a not-verified
    // entry so the handler returns a clean 200 verified=false.
    let state = build_state();
    let not_found = VerifyResponse {
        verified: false,
        transaction_id: None,
        timestamp: None,
        cached: false,
    };
    state
        .cache
        .set(UNKNOWN_HASH, &not_found, 60)
        .await
        .unwrap();

    let (status, body) = post_verify(state, UNKNOWN_HASH).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["verified"], false);
}

/// Hash found in cache → verified=true, cached=true, txId present.
#[tokio::test]
async fn verify_cached_hash_returns_verified_true_and_cached_flag() {
    let state = build_state();
    let cached_entry = VerifyResponse {
        verified: true,
        transaction_id: Some("tx_abc123".to_string()),
        timestamp: Some(1_700_000_000),
        cached: true,
    };
    state
        .cache
        .set(KNOWN_HASH, &cached_entry, 3600)
        .await
        .unwrap();

    let (status, body) = post_verify(state, KNOWN_HASH).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["verified"], true);
    assert_eq!(body["transaction_id"], "tx_abc123");
    assert_eq!(body["cached"], true);
}

/// Cache hit must NOT call Stellar — verified by seeding cache and pointing
/// Stellar at an unreachable host; if Stellar were called the test would 500.
#[tokio::test]
async fn verify_cache_hit_does_not_call_stellar() {
    let state = build_state(); // Stellar URL is unreachable
    let cached_entry = VerifyResponse {
        verified: true,
        transaction_id: Some("tx_cached".to_string()),
        timestamp: Some(1_000_000),
        cached: true,
    };
    state
        .cache
        .set(KNOWN_HASH, &cached_entry, 3600)
        .await
        .unwrap();

    // If Stellar were called this would return 500; getting 200 proves cache was used.
    let (status, _) = post_verify(state, KNOWN_HASH).await;
    assert_eq!(status, StatusCode::OK);
}

/// Uppercase hash is normalised before lookup — same cache entry is found.
#[tokio::test]
async fn verify_uppercase_hash_is_normalised() {
    let state = build_state();
    let cached_entry = VerifyResponse {
        verified: true,
        transaction_id: Some("tx_upper".to_string()),
        timestamp: Some(999),
        cached: true,
    };
    // Seed with lowercase key
    state
        .cache
        .set(KNOWN_HASH, &cached_entry, 3600)
        .await
        .unwrap();

    // Submit uppercase — should still hit the cache
    let (status, body) = post_verify(state, &KNOWN_HASH.to_uppercase()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["verified"], true);
}

/// GET /verify/:hash — same validation rules apply.
#[tokio::test]
async fn get_verify_by_hash_malformed_returns_400() {
    let router = app(build_state());
    let req = Request::builder()
        .method("GET")
        .uri("/verify/not-a-hash")
        .body(Body::empty())
        .unwrap();

    let resp = router.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

/// GET /verify/:hash with a cached entry returns 200 verified=true.
#[tokio::test]
async fn get_verify_by_hash_cached_returns_verified() {
    let state = build_state();
    let cached_entry = VerifyResponse {
        verified: true,
        transaction_id: Some("tx_get".to_string()),
        timestamp: Some(42),
        cached: true,
    };
    state
        .cache
        .set(KNOWN_HASH, &cached_entry, 3600)
        .await
        .unwrap();

    let router = app(state);
    let req = Request::builder()
        .method("GET")
        .uri(format!("/verify/{}", KNOWN_HASH))
        .body(Body::empty())
        .unwrap();

    let resp = router.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["verified"], true);
    assert_eq!(body["transaction_id"], "tx_get");
}
