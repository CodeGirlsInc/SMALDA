//! Integration tests for the `/metrics` access guard (#1380) and the
//! `POST /submit` payload cap (#1377).

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
const TOKEN: &str = "metrics-secret-token";

fn state_with_token(token: Option<&str>) -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new("https://horizon-testnet.stellar.org")),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(1000, 1000),
        submit_rate_limiter: build_rate_limiter(1000, 1000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
        metrics_token: token.map(str::to_string),
    }
}

fn metrics_request(path: &str, auth: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().uri(path);
    if let Some(value) = auth {
        builder = builder.header("authorization", value);
    }
    builder.body(Body::empty()).unwrap()
}

#[tokio::test]
async fn metrics_requires_a_token_when_configured() {
    let router = app(state_with_token(Some(TOKEN)));

    let response = router
        .oneshot(metrics_request("/metrics", None))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn metrics_rejects_a_wrong_token() {
    let router = app(state_with_token(Some(TOKEN)));

    let response = router
        .oneshot(metrics_request("/metrics", Some("Bearer not-the-token")))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn metrics_allows_the_configured_token_on_both_paths() {
    let router = app(state_with_token(Some(TOKEN)));
    let header = format!("Bearer {}", TOKEN);

    let response = router
        .clone()
        .oneshot(metrics_request("/metrics", Some(header.as_str())))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = router
        .oneshot(metrics_request("/v1/metrics", Some(header.as_str())))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn metrics_stays_open_when_no_token_is_configured() {
    let router = app(state_with_token(None));

    let response = router
        .oneshot(metrics_request("/metrics", None))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn oversized_submit_body_is_rejected_with_413() {
    let router = app(state_with_token(None));

    // Well beyond the 64 KiB cap, but still valid JSON so the size limit is the
    // only thing that can reject it.
    let padding = "a".repeat(128 * 1024);
    let payload = serde_json::json!({
        "document_hash": padding,
        "document_id": "doc-1",
        "submitter": "tester",
    })
    .to_string();

    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/submit")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}
