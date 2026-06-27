use axum_test::TestServer;
use std::sync::Arc;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::module::webhook::VerificationWebhookNotifier;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::{app, AppState, HistoryResponse, TransactionRecord};

fn create_test_state() -> AppState {
    let stellar = Arc::new(StellarClient::new("https://horizon-testnet.stellar.org"));
    let cache = Arc::new(CacheBackend::InMemory(InMemoryCache::new()));
    let metrics = Arc::new(MetricsRegistry::new());
    let notifier = Arc::new(VerificationWebhookNotifier::new());

    AppState {
        stellar,
        cache,
        metrics,
        stellar_secret_key: "test_secret".to_string(),
        notifier,
    }
}

fn valid_sha256_hash() -> &'static str {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

#[tokio::test]
async fn test_hash_with_no_history_returns_200_empty_array() {
    let state = create_test_state();
    let app = app(state);
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/verify/{}/history", valid_sha256_hash()))
        .await;

    response.assert_status_ok();
    let history: HistoryResponse = response.json();
    assert_eq!(history.count, 0);
    assert!(history.transactions.is_empty());
    assert_eq!(history.document_hash, valid_sha256_hash());
    assert!(!history.cached);
}

#[tokio::test]
async fn test_hash_with_one_record_returns_count_one() {
    let state = create_test_state();
    let cache_key = format!("history:{}", valid_sha256_hash());
    let transactions = vec![TransactionRecord {
        transaction_id: "tx123".to_string(),
        timestamp: 1620000000,
        verified: true,
    }];
    state
        .cache
        .set(&cache_key, &transactions, 3600)
        .await
        .unwrap();

    let app = app(state);
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/verify/{}/history", valid_sha256_hash()))
        .await;

    response.assert_status_ok();
    let history: HistoryResponse = response.json();
    assert_eq!(history.count, 1);
    assert_eq!(history.transactions.len(), 1);
    assert_eq!(history.transactions[0].transaction_id, "tx123");
    assert!(history.cached);
}

#[tokio::test]
async fn test_hash_with_multiple_transfers_returns_in_order() {
    let state = create_test_state();
    let cache_key = format!("history:{}", valid_sha256_hash());
    let transactions = vec![
        TransactionRecord {
            transaction_id: "tx1".to_string(),
            timestamp: 1620000000,
            verified: true,
        },
        TransactionRecord {
            transaction_id: "tx2".to_string(),
            timestamp: 1630000000,
            verified: true,
        },
        TransactionRecord {
            transaction_id: "tx3".to_string(),
            timestamp: 1640000000,
            verified: true,
        },
    ];
    state
        .cache
        .set(&cache_key, &transactions, 3600)
        .await
        .unwrap();

    let app = app(state);
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/verify/{}/history", valid_sha256_hash()))
        .await;

    response.assert_status_ok();
    let history: HistoryResponse = response.json();
    assert_eq!(history.count, 3);
    assert_eq!(history.transactions.len(), 3);
    assert_eq!(history.transactions[0].transaction_id, "tx1");
    assert_eq!(history.transactions[1].transaction_id, "tx2");
    assert_eq!(history.transactions[2].transaction_id, "tx3");
    assert!(history.cached);
}

#[tokio::test]
async fn test_cache_hit_returns_cached_true() {
    let state = create_test_state();
    let cache_key = format!("history:{}", valid_sha256_hash());
    let transactions = vec![TransactionRecord {
        transaction_id: "tx_cache".to_string(),
        timestamp: 1620000000,
        verified: true,
    }];
    state
        .cache
        .set(&cache_key, &transactions, 3600)
        .await
        .unwrap();

    let app = app(state);
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/verify/{}/history", valid_sha256_hash()))
        .await;

    response.assert_status_ok();
    let history: HistoryResponse = response.json();
    assert!(history.cached);
    assert_eq!(history.count, 1);
}

#[tokio::test]
async fn test_invalid_hash_format_returns_400() {
    let state = create_test_state();
    let app = app(state);
    let server = TestServer::new(app).unwrap();

    let invalid_hash = "invalid_hash"; // Not 64 hex chars
    let response = server
        .get(&format!("/verify/{}/history", invalid_hash))
        .await;

    response.assert_status_bad_request();
    let error: serde_json::Value = response.json();
    assert!(error.get("error").is_some());
    assert!(error["error"].as_str().unwrap().contains("wrong length"));
}

#[tokio::test]
async fn test_empty_hash_string_returns_400() {
    let state = create_test_state();
    let app = app(state);
    let server = TestServer::new(app).unwrap();

    let response = server.get("/verify//history").await;

    response.assert_status_bad_request();
    let error: serde_json::Value = response.json();
    assert!(error.get("error").is_some());
    assert!(error["error"]
        .as_str()
        .unwrap()
        .contains("must not be empty"));
}
