//! The write routes sign Stellar transactions with the anchor key, so they
//! require the service credential when `write_api_token` is configured (#1664).

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
const TOKEN: &str = "write-secret-token";

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
        write_api_token: Some(TOKEN.to_string()),
    }
}

fn post(path: &str, auth: Option<&str>) -> Request<Body> {
    let mut b = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json");
    if let Some(v) = auth {
        b = b.header("authorization", v);
    }
    b.body(Body::from("{}")).unwrap()
}

#[tokio::test]
async fn write_routes_reject_missing_and_wrong_credentials() {
    for path in ["/submit", "/revoke", "/transfer", "/v1/submit", "/v1/revoke", "/v1/transfer"] {
        let missing = app(state()).oneshot(post(path, None)).await.unwrap();
        assert_eq!(missing.status(), StatusCode::UNAUTHORIZED, "{path} without token");

        let wrong = app(state())
            .oneshot(post(path, Some("Bearer nope")))
            .await
            .unwrap();
        assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED, "{path} wrong token");
    }
}

#[tokio::test]
async fn write_routes_pass_auth_with_the_credential() {
    let header = format!("Bearer {TOKEN}");
    for path in ["/submit", "/revoke", "/transfer"] {
        let resp = app(state()).oneshot(post(path, Some(&header))).await.unwrap();
        // The empty body then fails validation; the point is it is not a 401.
        assert_ne!(resp.status(), StatusCode::UNAUTHORIZED, "{path} with token");
    }
}

#[tokio::test]
async fn verify_stays_public() {
    let resp = app(state()).oneshot(post("/verify", None)).await.unwrap();
    assert_ne!(resp.status(), StatusCode::UNAUTHORIZED);
}
