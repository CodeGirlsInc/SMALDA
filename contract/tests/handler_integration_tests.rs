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
