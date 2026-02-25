use axum::http::StatusCode;
use axum_test::TestServer;
use httpmock::MockServer;
use std::sync::Arc;
use stellar_doc_verifier::cache::InMemoryCache;
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{app, AppState};

// Helper: Builds full Axum router
async fn test_app() -> (TestServer, MockServer) {
    let mock_server = MockServer::start();

    // Use testnet URL from MockServer
    let stellar = Arc::new(StellarClient::new(&mock_server.base_url()));
    let cache = Arc::new(stellar_doc_verifier::cache::CacheBackend::InMemory(InMemoryCache::new()));
    let metrics = Arc::new(MetricsRegistry::new());

    let state = AppState {
        stellar,
        cache,
        metrics,
    };

    let router = app(state);
    let server = TestServer::new(router).unwrap();
    (server, mock_server)
}

// Helper: Configure mock to return given result for verify
fn mock_stellar_verify(server: &MockServer, hash: &str, verified: bool) {
    let mock_resp = if verified {
        format!(
            r#"{{
            "_embedded": {{
                "records": [
                    {{
                        "id": "tx123",
                        "created_at": "2023-01-01T00:00:00Z",
                        "memo": "{}"
                    }}
                ]
            }}
        }}"#,
            hash
        )
    } else {
        r#"{
            "_embedded": {
                "records": []
            }
        }"#
        .to_string()
    };

    server.mock(|when, then| {
        when.method(httpmock::Method::GET).path("/transactions");
        then.status(200)
            .header("content-type", "application/json")
            .body(mock_resp);
    });
}

// Helper: valid SHA256 string
fn valid_sha256() -> String {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()
}

#[tokio::test]
async fn test_health() {
    let (server, _) = test_app().await;
    let response = server.get("/health").await;
    response.assert_status(StatusCode::OK);
}

#[tokio::test]
async fn test_metrics() {
    let (server, _) = test_app().await;
    let response = server.get("/metrics").await;
    response.assert_status(StatusCode::OK);
    let text = response.text();
    assert!(text.contains("stellar_doc_verifier"));
}

#[tokio::test]
async fn test_verify_valid() {
    let (server, mock) = test_app().await;
    let hash = valid_sha256();
    mock_stellar_verify(&mock, &hash, true);

    let response = server
        .post("/verify")
        .json(&serde_json::json!({
            "document_hash": hash
        }))
        .await;

    response.assert_status(StatusCode::OK);
    let json: serde_json::Value = response.json();
    assert_eq!(json["verified"], true);
}

#[tokio::test]
async fn test_verify_invalid() {
    let (server, _) = test_app().await;

    // Requirement: invalid hash -> 400
    // Notice: our current endpoint doesn't validate length, 
    // so this test will likely fail until endpoints are properly finished.
    let response = server
        .post("/verify")
        .json(&serde_json::json!({
            "document_hash": "short"
        }))
        .await;

    response.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_stellar_failure() {
    let (server, mock) = test_app().await;
    let hash = valid_sha256();

    // Mock a 500 error from stellar
    mock.mock(|when, then| {
        when.method(httpmock::Method::GET).path("/transactions");
        then.status(500);
    });

    let response = server
        .post("/verify")
        .json(&serde_json::json!({
            "document_hash": hash
        }))
        .await;

    response.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn test_verify_by_hash_get() {
    let (server, mock) = test_app().await;
    let hash = valid_sha256();
    mock_stellar_verify(&mock, &hash, true);

    let response = server.get(&format!("/verify/{}", hash)).await;
    response.assert_status(StatusCode::OK);
    let json: serde_json::Value = response.json();
    assert_eq!(json["verified"], true);
}

#[tokio::test]
async fn test_verify_batch() {
    let (server, _) = test_app().await;
    let response = server
        .post("/verify/batch")
        .json(&serde_json::json!({
            "hashes": []
        }))
        .await;

    // missing or empty batch -> 400
    response.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_history() {
    let (server, _) = test_app().await;
    let hash = valid_sha256();
    let response = server.get(&format!("/verify/{}/history", hash)).await;

    // Endpoint not yet existing or not found -> 404
    response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_submit_missing_secret() {
    let (server, _) = test_app().await;
    let response = server
        .post("/submit")
        .json(&serde_json::json!({
            "document_hash": valid_sha256()
        }))
        .await;

    // Issue: missing secret key -> appropriate error (e.g. 401 or 400).
    response.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_revoke_non_existent_hash() {
    let (server, mock) = test_app().await;
    let hash = valid_sha256();
    
    // Mock Stellar to return no records (hash doesn't exist)
    mock_stellar_verify(&mock, &hash, false);

    let response = server
        .post("/revoke")
        .json(&serde_json::json!({
            "document_hash": hash,
            "reason": "Test revocation",
            "revoked_by": "test_user"
        }))
        .await;

    // Non-existent hash should return 404
    response.assert_status(StatusCode::NOT_FOUND);
    let json: serde_json::Value = response.json();
    assert_eq!(json["error"], "Document hash not found");
}

#[tokio::test]
async fn test_revoke_existing_hash() {
    let (server, mock) = test_app().await;
    let hash = valid_sha256();
    
    // Mock Stellar to return the hash exists
    mock_stellar_verify(&mock, &hash, true);
    
    // Mock the revocation submission
    mock.mock(|when, then| {
        when.method(httpmock::Method::POST).path("/transactions");
        then.status(200)
            .header("content-type", "application/json")
            .body(r#"{"id": "revoke_tx_123"}"#);
    });

    let response = server
        .post("/revoke")
        .json(&serde_json::json!({
            "document_hash": hash,
            "reason": "Document superseded",
            "revoked_by": "admin@example.com"
        }))
        .await;

    response.assert_status(StatusCode::OK);
    let json: serde_json::Value = response.json();
    assert_eq!(json["transaction_id"], "revoke_tx_123");
    assert!(json["revoked_at"].is_number());
}

#[tokio::test]
async fn test_revoke_missing_fields() {
    let (server, _) = test_app().await;
    
    // Missing reason and revoked_by fields
    let response = server
        .post("/revoke")
        .json(&serde_json::json!({
            "document_hash": valid_sha256()
        }))
        .await;

    // Should return 400 for missing required fields
    response.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_transfer_invalid_date() {
    let (server, _) = test_app().await;
    let response = server
        .post("/transfer")
        .json(&serde_json::json!({
            "document_hash": valid_sha256(),
            "date": "invalid_date_format"
        }))
        .await;

    // invalid date -> 400
    response.assert_status(StatusCode::BAD_REQUEST);
}
