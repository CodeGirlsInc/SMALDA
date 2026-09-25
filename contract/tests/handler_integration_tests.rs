//! Integration tests verifying HTTP handler routing, inputs, and error codes.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::sync::Arc;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::rate_limit::build_rate_limiter;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::AppState;
use tower::util::ServiceExt;

const SECRET: &str = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

fn test_app_state() -> AppState {
    let cache = CacheBackend::InMemory(InMemoryCache::new());
    let stellar = Arc::new(StellarClient::new("https://horizon-testnet.stellar.org"));
    let metrics = Arc::new(MetricsRegistry::new());

    AppState {
        stellar,
        cache: Arc::new(cache),
        metrics,
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(1000, 1000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
    }
}

#[tokio::test]
async fn test_health_check_returns_200() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.get("status").is_some());
    assert!(json.get("stellar_connected").is_some());
    assert!(json.get("redis_connected").is_some());
}

#[tokio::test]
async fn test_metrics_handler_returns_prometheus_text() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let text = String::from_utf8(body.to_vec()).unwrap();
    assert!(text.contains("requests_total"));
}

#[tokio::test]
async fn test_audit_log_handler_returns_200() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .uri("/audit")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_verify_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/verify")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"document_hash": "invalid"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_with_empty_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/verify")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"document_hash": ""}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_by_hash_path_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/verify/not-a-valid-sha256-hash")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_history_path_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/verify/not-a-valid-sha256-hash/history")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_batch_verify_empty_array_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/verify/batch")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"hashes": []}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_batch_verify_too_many_hashes_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let hashes: Vec<String> = (0..51).map(|i| format!("{:064x}", i)).collect();
    let body = serde_json::json!({"hashes": hashes}).to_string();

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/verify/batch")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_batch_verify_mixed_valid_and_invalid_hashes_returns_per_item_results() {
    let state = test_app_state();
    let valid_hash_1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    let invalid_hash_short = "too-short";
    let invalid_hash_bad_chars = "z".repeat(64);
    let valid_hash_2 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    // Prime cache for valid_hash_1 so it verifies true
    let cached_resp = stellar_doc_verifier::VerifyResponse {
        verified: true,
        transaction_id: Some("tx_integration_1".to_string()),
        timestamp: Some(1700000000),
        cached: true,
        revoked: None,
        revoked_at: None,
    };
    state
        .cache
        .set(valid_hash_1, &cached_resp, 3600)
        .await
        .unwrap();

    let router = app(state);

    let body = serde_json::json!({
        "hashes": [
            valid_hash_1,
            invalid_hash_short,
            invalid_hash_bad_chars,
            valid_hash_2
        ]
    })
    .to_string();

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/verify/batch")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp: stellar_doc_verifier::BatchVerifyResponse =
        serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(resp.total, 4);
    assert_eq!(resp.verified_count, 1);
    assert_eq!(resp.failed_count, 3);
    assert_eq!(resp.results.len(), 4);

    // Item 0: valid and verified from cache
    assert_eq!(resp.results[0].hash, valid_hash_1);
    assert!(resp.results[0].verified);
    assert_eq!(
        resp.results[0].transaction_id,
        Some("tx_integration_1".to_string())
    );
    assert_eq!(resp.results[0].timestamp, Some(1700000000));
    assert!(resp.results[0].error.is_none());

    // Item 1: invalid length -> per-item error without failing batch
    assert_eq!(resp.results[1].hash, invalid_hash_short);
    assert!(!resp.results[1].verified);
    assert!(resp.results[1].error.is_some());
    assert!(resp.results[1]
        .error
        .as_ref()
        .unwrap()
        .contains("wrong length"));

    // Item 2: invalid character -> per-item error without failing batch
    assert_eq!(resp.results[2].hash, invalid_hash_bad_chars);
    assert!(!resp.results[2].verified);
    assert!(resp.results[2].error.is_some());
    assert!(resp.results[2]
        .error
        .as_ref()
        .unwrap()
        .contains("invalid character"));

    // Item 3: valid format hash but query failed / not found -> verified: false
    assert_eq!(resp.results[3].hash, valid_hash_2);
    assert!(!resp.results[3].verified);
}

#[tokio::test]
async fn test_submit_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/submit")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"document_hash": "invalid", "document_id": "doc1", "submitter": "test"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_revoke_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/revoke")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"document_hash": "invalid", "reason": "test", "revoked_by": "admin"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_transfer_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/transfer")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"document_hash": "invalid", "from_owner": "A", "to_owner": "B", "transfer_date": "2025-01-01", "transfer_reference": "REF1"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_transfer_with_invalid_date_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/transfer")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"document_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "from_owner": "A", "to_owner": "B", "transfer_date": "invalid-date", "transfer_reference": "REF1"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// ── #1346: ownership-chain pagination on the mounted history endpoint ───────

use stellar_doc_verifier::stellar::TransactionRecord;

const CHAIN_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

fn chain_records(n: usize) -> Vec<TransactionRecord> {
    (0..n)
        .map(|i| TransactionRecord {
            transaction_id: format!("tx-{:03}", i),
            timestamp: 1_700_000_000 + i as i64,
            verified: true,
        })
        .collect()
}

async fn state_with_chain(records: Vec<TransactionRecord>) -> AppState {
    let cache = CacheBackend::InMemory(InMemoryCache::new());
    cache
        .set(&format!("history:{}", CHAIN_HASH), &records, 3600)
        .await
        .unwrap();
    AppState {
        stellar: Arc::new(StellarClient::new("https://horizon-testnet.stellar.org")),
        cache: Arc::new(cache),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(1000, 1000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
    }
}

async fn get_chain(
    query: &str,
    records: Vec<TransactionRecord>,
) -> (StatusCode, serde_json::Value) {
    let router = app(state_with_chain(records).await);
    let response = router
        .oneshot(
            Request::builder()
                .uri(format!("/verify/{}{}", CHAIN_HASH, query))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&body).unwrap())
}

#[tokio::test]
async fn test_verify_history_without_params_returns_the_whole_chain() {
    let (status, json) = get_chain("/history", chain_records(5)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["count"], 5);
    assert_eq!(json["transactions"].as_array().unwrap().len(), 5);
    assert!(json["next_cursor"].is_null());
}

#[tokio::test]
async fn test_verify_history_first_page_reports_next_cursor() {
    let (status, json) = get_chain("/history?cursor=0&page_size=2", chain_records(5)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["count"], 5);
    assert_eq!(json["next_cursor"], 2);
    let page = json["transactions"].as_array().unwrap();
    assert_eq!(page.len(), 2);
    assert_eq!(page[0]["transaction_id"], "tx-000");
}

#[tokio::test]
async fn test_verify_history_last_page_has_null_next_cursor() {
    let (status, json) = get_chain("/history?cursor=4&page_size=2", chain_records(5)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["count"], 5);
    assert_eq!(json["transactions"].as_array().unwrap().len(), 1);
    assert!(json["next_cursor"].is_null());
}

#[tokio::test]
async fn test_verify_history_cursor_past_the_end_is_empty_not_500() {
    let (status, json) = get_chain("/history?cursor=99&page_size=2", chain_records(5)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["count"], 5);
    assert!(json["transactions"].as_array().unwrap().is_empty());
    assert!(json["next_cursor"].is_null());
}

#[tokio::test]
async fn test_verify_history_page_size_is_capped_at_the_maximum() {
    let (status, json) = get_chain("/history?page_size=100000", chain_records(250)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["count"], 250);
    assert_eq!(json["transactions"].as_array().unwrap().len(), 200);
    assert_eq!(json["next_cursor"], 200);
}
