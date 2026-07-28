use axum::http::{Request, StatusCode};
use axum::body::Body;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::config::AppConfig;
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::AppState;
use std::sync::Arc;
use tower::ServiceExt;

fn test_app_state() -> AppState {
    let cache = CacheBackend::InMemory(InMemoryCache::new());
    let stellar = Arc::new(StellarClient::new("https://horizon-testnet.stellar.org"));
    let metrics = Arc::new(MetricsRegistry::new());

    AppState {
        stellar,
        cache: Arc::new(cache),
        metrics,
        stellar_secret_key: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string(),
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

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
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

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body.to_vec()).unwrap();
    assert!(text.contains("requests_total"));
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
async fn test_submit_with_invalid_hash_returns_400() {
    let state = test_app_state();
    let router = app(state);

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/submit")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"document_hash": "invalid", "document_id": "doc1", "submitter": "test"}"#))
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
                .body(Body::from(r#"{"document_hash": "invalid", "reason": "test", "revoked_by": "admin"}"#))
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
                .body(Body::from(r#"{"document_hash": "invalid", "from_owner": "A", "to_owner": "B", "transfer_date": "2025-01-01", "transfer_reference": "REF1"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
