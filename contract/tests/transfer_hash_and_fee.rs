//! Transfer hash normalization and configurable base fee.
//!
//! Covers the two places where a value crossed a boundary without being
//! normalized or configured:
//!
//! - `compute_transfer_hash` hashed the **raw** `document_hash`, so the same
//!   transfer produced a different on-chain id depending only on the hex case
//!   the client happened to send.
//! - `StellarClient` hardcoded `MIN_BASE_FEE`, leaving no lever during a fee
//!   spike.

use std::sync::Arc;

use axum_test::TestServer;
use stellar_base::transaction::MIN_BASE_FEE;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::handlers::transfer::compute_transfer_hash;
use stellar_doc_verifier::hash_validator::HashValidator;
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::rate_limit::build_rate_limiter;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::types::{AppState, TransferRecord, TransferRequest};

const SECRET: &str = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

fn valid_hash() -> String {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()
}

fn test_state() -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new("http://localhost:8080")),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(1_000, 1_000),
        submit_rate_limiter: build_rate_limiter(1_000, 1_000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
    }
}

fn compute_transfer_hash_of(document_hash: &str) -> String {
    compute_transfer_hash(&transfer_request(document_hash))
}

fn transfer_request(document_hash: &str) -> TransferRequest {
    TransferRequest {
        document_hash: document_hash.to_string(),
        from_owner: "alice".to_string(),
        to_owner: "bob".to_string(),
        transfer_date: "2024-01-15".to_string(),
        transfer_reference: None,
    }
}

fn transfer_record(document_hash: &str) -> TransferRecord {
    TransferRecord {
        document_hash: HashValidator::normalize(document_hash),
        from_owner: "alice".to_string(),
        to_owner: "bob".to_string(),
        transfer_date: "2024-01-15".to_string(),
        transfer_reference: None,
        transfer_hash: "deadbeef".to_string(),
        memo: "TRANSFER:deadbeef".to_string(),
        anchored_at: "2024-01-15T00:00:00+00:00".to_string(),
    }
}

// ---------------------------------------------------------------------------
// Hex case must not change the identity of a transfer
// ---------------------------------------------------------------------------

#[test]
fn transfer_hash_is_identical_regardless_of_hex_case() {
    // The core regression. Before normalization these differed, which meant two
    // Stellar memos and two on-chain transaction ids for one logical transfer.
    let lower = compute_transfer_hash_of(&valid_hash());
    let upper = compute_transfer_hash_of(&valid_hash().to_uppercase());

    assert_eq!(lower, upper, "hex case must not change the transfer hash");
}

#[test]
fn transfer_hash_is_also_stable_under_surrounding_whitespace() {
    // `HashValidator::normalize` trims as well as lowercasing, so a stray space
    // cannot fork the identity either.
    let padded = compute_transfer_hash_of(&format!("  {}  ", valid_hash()));
    assert_eq!(padded, compute_transfer_hash_of(&valid_hash()));
}

#[test]
fn transfer_hash_still_depends_on_its_other_fields() {
    // Guards against "fixing" the case bug by dropping a field from the hash.
    let base = transfer_request(&valid_hash());
    let base_hash = compute_transfer_hash(&base);

    let mut different_owner = base.clone();
    different_owner.to_owner = "carol".to_string();
    assert_ne!(base_hash, compute_transfer_hash(&different_owner));

    let mut different_date = base.clone();
    different_date.transfer_date = "2024-02-15".to_string();
    assert_ne!(base_hash, compute_transfer_hash(&different_date));

    let mut different_hash = base.clone();
    different_hash.document_hash = "b".repeat(64);
    assert_ne!(base_hash, compute_transfer_hash(&different_hash));
}

#[tokio::test]
async fn transfer_history_is_found_regardless_of_the_hex_case_in_the_url() {
    // Records are keyed by the normalized hash. A caller passing uppercase hex
    // used to get an empty history for a document that genuinely had transfers
    // on record, which reads as "this document has never been transferred".
    let state = test_state();
    let server = TestServer::new(app(state.clone())).unwrap();

    let hash = valid_hash();
    state
        .cache
        .set(
            &format!("transfer:{}", hash),
            &vec![transfer_record(&hash)],
            600,
        )
        .await
        .unwrap();

    let lowercase: Vec<TransferRecord> = server
        .get(&format!("/v1/transfer/{}", hash))
        .await
        .as_json()
        .unwrap();
    assert_eq!(lowercase.len(), 1, "lowercase lookup should find the record");

    let uppercase: Vec<TransferRecord> = server
        .get(&format!("/v1/transfer/{}", hash.to_uppercase()))
        .await
        .as_json()
        .unwrap();
    assert_eq!(
        uppercase.len(),
        1,
        "an empty result for the uppercase spelling is the bug"
    );
}

// ---------------------------------------------------------------------------
// Configurable base fee
// ---------------------------------------------------------------------------

#[test]
fn a_new_client_uses_the_network_minimum_fee() {
    let client = StellarClient::new("http://localhost:8080");
    assert_eq!(client.base_fee(), MIN_BASE_FEE);
}

#[test]
fn the_base_fee_can_be_raised_for_a_fee_spike() {
    // The lever the issue asks for: during a spike an operator raises the fee
    // and anchoring stops failing with `insufficient fee`.
    let client = StellarClient::new("http://localhost:8080").with_base_fee(200_000);
    assert_eq!(client.base_fee(), 200_000);
}

#[test]
fn a_zero_base_fee_falls_back_to_the_minimum() {
    // Every Stellar network rejects a zero fee, so honouring one would turn a
    // config typo into a submission failure during an incident.
    let client = StellarClient::new("http://localhost:8080").with_base_fee(0);
    assert_eq!(client.base_fee(), MIN_BASE_FEE);
}

#[test]
fn with_base_fee_is_chainable_and_last_call_wins() {
    let client = StellarClient::new("http://localhost:8080")
        .with_base_fee(1_000)
        .with_base_fee(50_000);
    assert_eq!(client.base_fee(), 50_000);
}