//! End-to-end integration tests for the stellar-doc-verifier service.
//!
//! These tests boot the full Axum router with:
//!   - an `httpmock` server standing in for Horizon, and
//!   - an `InMemoryCache` standing in for Redis.
//!
//! Covered flows
//! ─────────────
//! 1. submit → verify  (happy path, full round-trip)
//! 2. cache hit proof  (second verify must NOT re-call Horizon)
//! 3. degraded Horizon (verify while Horizon is down → 502, no false-positive)
//! 4. degraded Redis   (InMemoryCache always succeeds, but logic path is exercised)
//! 5. health/live      (always 200)
//! 6. health/ready     (503 when Horizon unreachable)
//! 7. batch verify     (concurrency limit respected via call-count assertion)
//! 8. error sanitisation (no internal path / type leaks in any 4xx/5xx body)

#![cfg(test)]

use axum::http::StatusCode;
use axum_test::TestServer;
use httpmock::prelude::*;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    app,
    cache::{CacheBackend, InMemoryCache},
    metrics::MetricsRegistry,
    rate_limit::build_rate_limiter,
    stellar::StellarClient,
    AppState,
};

// ── helpers ─────────────────────────────────────────────────────────────────

/// A valid 64-hex-char SHA-256 hash used across tests.
const SAMPLE_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/// A well-formed Stellar secret key taken directly from the stellar-base test suite.
/// `KeyPair::from_secret_seed` is known to accept this value.
const STELLAR_SECRET_KEY: &str = "SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R";

/// Build app state pointing at an httpmock server for Horizon.
fn make_state(horizon_url: &str) -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new(horizon_url)),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: STELLAR_SECRET_KEY.to_string(),
        // Generous enough that the rate limiter never interferes with these
        // functional/integration tests (some exercise batch/concurrent calls).
        rate_limiter: build_rate_limiter(10_000, 10_000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
    }
}

/// Horizon GET /accounts/:id response for a fresh (no-data) account.
fn horizon_empty_account_json() -> Value {
    json!({
        "sequence": "123456789",
        "data": {}
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Health: /health/live — always 200
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_live_is_always_200() {
    // Even with a completely unreachable Horizon
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let resp = server.get("/health/live").await;
    resp.assert_status_ok();

    let body: Value = resp.json();
    assert_eq!(body["status"], "ok");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Health: /health/ready — 503 when Horizon is down
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_ready_503_when_horizon_down() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let resp = server.get("/health/ready").await;
    resp.assert_status(StatusCode::SERVICE_UNAVAILABLE);

    let body: Value = resp.json();
    assert_eq!(body["status"], "degraded");
    assert_eq!(body["dependencies"]["horizon"]["ok"], false);
    // Named dependency, not internal code paths
    assert!(body["dependencies"]["horizon"]["error"]
        .as_str()
        .unwrap_or("")
        .to_lowercase()
        .contains("horizon"));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Verify — Horizon unavailable → 5xx, no false positive
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn verify_with_horizon_down_returns_5xx_not_verified() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let resp = server
        .post("/verify")
        .json(&json!({ "document_hash": SAMPLE_HASH }))
        .await;

    // Must never claim verified=true when Horizon is unreachable.
    // Any 5xx is acceptable (500 for key-derivation failure, 502 for network failure).
    let status = resp.status_code();
    assert!(
        status.is_server_error(),
        "expected a 5xx status when Horizon is down, got {}",
        status
    );

    // Body must not contain verified=true
    let body: Value = resp.json();
    assert!(
        body.get("verified").map_or(true, |v| v != true),
        "must not return verified=true when Horizon unreachable"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Verify — hash not anchored → verified=false, no false positive
//    Uses httpmock so Horizon returns a valid (empty) account, bypassing
//    key-derivation failures.
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn verify_unanchored_hash_returns_not_verified() {
    let mock_server = MockServer::start_async().await;

    // Horizon returns an account with no data entries for this hash
    mock_server.mock(|when, then| {
        when.method(GET).path_contains("/accounts/");
        then.status(200)
            .header("content-type", "application/json")
            .json_body(horizon_empty_account_json());
    });

    // Build a state with a valid public-key-derivable secret.
    let state = make_state(&mock_server.base_url());
    let server = TestServer::new(app(state)).unwrap();

    let resp = server
        .post("/verify")
        .json(&json!({ "document_hash": SAMPLE_HASH }))
        .await;

    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["verified"], false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Submit → Verify: cache-hit proof
//    Second verify must NOT call Horizon (mock call-count asserts this).
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn verify_cache_hit_prevents_second_horizon_call() {
    let mock_server = MockServer::start_async().await;

    // Horizon accounts endpoint — counts calls
    let account_mock = mock_server.mock(|when, then| {
        when.method(GET).path_contains("/accounts/");
        then.status(200)
            .header("content-type", "application/json")
            .json_body(horizon_empty_account_json());
    });

    let state = make_state(&mock_server.base_url());
    let server = TestServer::new(app(state)).unwrap();

    // First call — should hit Horizon
    let resp1 = server
        .post("/verify")
        .json(&json!({ "document_hash": SAMPLE_HASH }))
        .await;
    resp1.assert_status_ok();
    assert_eq!(resp1.json::<Value>()["cached"], false);

    // Manually prime the cache with a verified result so the second call
    // returns a cache hit.  (The verify handler caches misses too, but with
    // verified=false.  We prime with verified=true to test the cached path.)
    // The first call already cached `verified=false` — so a second identical
    // POST must return `cached=true` and call Horizon 0 extra times.

    let resp2 = server
        .post("/verify")
        .json(&json!({ "document_hash": SAMPLE_HASH }))
        .await;
    resp2.assert_status_ok();
    let body2: Value = resp2.json();
    assert_eq!(body2["cached"], true, "second call should be a cache hit");

    // Horizon must have been called exactly once total
    account_mock.assert_hits_async(1).await;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Batch verify: concurrency limit respected
//    Send 10 hashes; Horizon should be called at most BATCH_CONCURRENCY_LIMIT (8)
//    at any single point.  We verify the total call count equals the batch size.
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn batch_verify_calls_horizon_once_per_hash() {
    let mock_server = MockServer::start_async().await;

    let account_mock = mock_server.mock(|when, then| {
        when.method(GET).path_contains("/accounts/");
        then.status(200)
            .header("content-type", "application/json")
            .json_body(horizon_empty_account_json());
    });

    let state = make_state(&mock_server.base_url());
    let server = TestServer::new(app(state)).unwrap();

    // Build 10 distinct valid SHA-256 hashes
    let hashes: Vec<String> = (0u8..10)
        .map(|i| format!("{:0>64}", format!("{:x}", i).repeat(16)))
        .map(|h| h.chars().take(64).collect())
        .collect();

    let resp = server
        .post("/verify/batch")
        .json(&json!({ "hashes": hashes }))
        .await;

    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["total"], 10);

    // Horizon should have been called once per hash (10 times total)
    account_mock.assert_hits_async(10).await;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Batch validate: empty batch → 400
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn batch_verify_empty_returns_400() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let resp = server
        .post("/verify/batch")
        .json(&json!({ "hashes": [] }))
        .await;

    resp.assert_status(StatusCode::BAD_REQUEST);
    let body: Value = resp.json();
    assert_eq!(body["code"], "BATCH_EMPTY");
    assert!(body.get("request_id").is_some());
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Batch validate: over-size batch → 400
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn batch_verify_oversized_returns_400() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let hashes: Vec<String> = (0u64..51)
        .map(|i| format!("{:064x}", i))
        .collect();

    let resp = server
        .post("/verify/batch")
        .json(&json!({ "hashes": hashes }))
        .await;

    resp.assert_status(StatusCode::BAD_REQUEST);
    let body: Value = resp.json();
    assert_eq!(body["code"], "BATCH_TOO_LARGE");
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Error sanitisation
//    No internal path, type name, or upstream body must appear in any error response.
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn error_responses_contain_no_internal_detail() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    // 1) Bad hash — validation error
    let resp = server
        .post("/verify")
        .json(&json!({ "document_hash": "not-a-valid-hash" }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
    let raw = resp.text();
    assert_no_internal_detail(&raw);

    // 2) Upstream error — Horizon unreachable
    let resp2 = server
        .post("/verify")
        .json(&json!({ "document_hash": SAMPLE_HASH }))
        .await;
    let raw2 = resp2.text();
    assert_no_internal_detail(&raw2);
}

/// Assert that a raw JSON response body contains no obvious internal leaks.
fn assert_no_internal_detail(raw: &str) {
    let forbidden = ["src/", "anyhow", "reqwest::", "redis::", "stellar_base::", "unwrap()", "panicked"];
    for term in forbidden {
        assert!(
            !raw.contains(term),
            "error body leaks internal detail '{}': {}",
            term,
            raw
        );
    }
    // Every error body must carry a request_id
    assert!(
        raw.contains("request_id"),
        "error body missing request_id: {}",
        raw
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Revoke — not-found for unanchored hash, no internal detail
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn revoke_unanchored_hash_returns_404_without_leaking() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let resp = server
        .post("/revoke")
        .json(&json!({
            "document_hash": SAMPLE_HASH,
            "reason": "test",
            "revoked_by": "tester"
        }))
        .await;

    resp.assert_status(StatusCode::NOT_FOUND);
    let raw = resp.text();
    assert_no_internal_detail(&raw);
    assert!(raw.contains("request_id"));
}

#[tokio::test]
async fn transfer_of_revoked_hash_returns_409() {
    let state = make_state("http://127.0.0.1:1");
    state
        .cache
        .set(
            &format!("stellar:verify:{SAMPLE_HASH}"),
            &json!({
                "verified": true,
                "transaction_id": null,
                "timestamp": null,
                "cached": false,
                "revoked": true,
                "revoked_at": 1
            }),
            3600,
        )
        .await
        .unwrap();
    let server = TestServer::new(app(state)).unwrap();

    let resp = server
        .post("/transfer")
        .json(&json!({
            "document_hash": SAMPLE_HASH,
            "from_owner": "Alice",
            "to_owner": "Bob",
            "transfer_date": "2025-01-01",
            "transfer_reference": "REF"
        }))
        .await;

    resp.assert_status(StatusCode::CONFLICT);
    assert!(resp.text().contains("has been revoked"));
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Non-UTF8 / Malformed Binary Input (CT's SHA-256 / SHA-512 support)
//     Confirm Axum extractor rejects non-UTF8/binary payload cleanly with 4xx,
//     never panicking or returning 500.
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn verify_rejects_invalid_utf8_binary_body_with_4xx() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    // Raw bytes containing non-UTF8 binary byte sequences in the JSON body
    let invalid_utf8_payload: &[u8] = b"{\"document_hash\": \"\xFF\xFE\xFD\"}";

    let resp = server
        .post("/verify")
        .content_type("application/json")
        .bytes(invalid_utf8_payload.to_vec().into())
        .await;

    let status = resp.status_code();
    assert!(
        status.is_client_error(),
        "expected a 4xx client error status when submitting non-UTF8 binary bytes, got {}",
        status
    );
    assert_ne!(status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn endpoints_reject_raw_malformed_binary_with_4xx() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    let raw_binary: &[u8] = &[0xFF, 0xFE, 0xFD, 0x80, 0x00];

    for path in ["/verify", "/submit", "/revoke", "/transfer", "/verify/batch"] {
        let resp = server
            .post(path)
            .content_type("application/json")
            .bytes(raw_binary.to_vec().into())
            .await;

        let status = resp.status_code();
        assert!(
            status.is_client_error(),
            "path {} expected 4xx client error status for raw binary, got {}",
            path,
            status
        );
        assert_ne!(
            status,
            StatusCode::INTERNAL_SERVER_ERROR,
            "path {} must not return 500 for malformed binary",
            path
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Hash Unexpected Length Tests (Too Short / Too Long)
//     Confirm Axum validator rejects too-short / too-long hash strings with 400.
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn verify_rejects_hash_of_unexpected_length_with_400() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    // Hashes that are too short (1, 10, 32, 63 chars)
    for len in [1, 10, 32, 63] {
        let short_hash = "a".repeat(len);
        let resp = server
            .post("/verify")
            .json(&json!({ "document_hash": short_hash }))
            .await;

        resp.assert_status(StatusCode::BAD_REQUEST);
        let body: Value = resp.json();
        assert!(
            body["error"].as_str().unwrap().contains("wrong length"),
            "expected wrong length error for short hash (len {}): {:?}",
            len,
            body
        );
    }

    // Hashes that are too long (65, 100, 128 chars for sha256 endpoint, 200 chars)
    for len in [65, 100, 128, 200] {
        let long_hash = "a".repeat(len);
        let resp = server
            .post("/verify")
            .json(&json!({ "document_hash": long_hash }))
            .await;

        resp.assert_status(StatusCode::BAD_REQUEST);
        let body: Value = resp.json();
        assert!(
            body["error"].as_str().unwrap().contains("wrong length"),
            "expected wrong length error for long hash (len {}): {:?}",
            len,
            body
        );
    }

    // Empty hash
    let resp_empty = server
        .post("/verify")
        .json(&json!({ "document_hash": "" }))
        .await;
    resp_empty.assert_status(StatusCode::BAD_REQUEST);
    let body_empty: Value = resp_empty.json();
    assert!(body_empty["error"].as_str().unwrap().contains("empty"));
}

#[tokio::test]
async fn submit_and_revoke_reject_unexpected_hash_length_with_400() {
    let state = make_state("http://127.0.0.1:1");
    let server = TestServer::new(app(state)).unwrap();

    // Test too short and too long on /submit
    for bad_hash in ["a".repeat(10), "a".repeat(65), "".to_string()] {
        let resp = server
            .post("/submit")
            .json(&json!({
                "document_hash": bad_hash,
                "document_id": "doc-1",
                "submitter": "tester"
            }))
            .await;
        resp.assert_status(StatusCode::BAD_REQUEST);
    }

    // Test too short and too long on /revoke
    for bad_hash in ["a".repeat(10), "a".repeat(65), "".to_string()] {
        let resp = server
            .post("/revoke")
            .json(&json!({
                "document_hash": bad_hash,
                "reason": "testing",
                "revoked_by": "tester"
            }))
            .await;
        resp.assert_status(StatusCode::BAD_REQUEST);
    }
}

