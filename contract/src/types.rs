use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

use crate::hash_validator::ValidationError as HashValidationError;
use crate::stellar::TransactionRecord;

// Application state
#[derive(Clone)]
pub struct AppState {
    pub stellar: crate::stellar::StellarClient,
    pub cache: crate::cache::CacheBackend,
    pub metrics: crate::metrics::MetricsRegistry,
    pub stellar_secret_key: String,
}

// Request/Response types
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct VerifyRequest {
    pub document_hash: String,
    pub transaction_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct VerifyResponse {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub cached: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revoked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revoked_at: Option<i64>,
}

/// Request type for submitting a document hash to Stellar blockchain
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SubmitRequest {
    pub document_hash: String,
    pub document_id: String,
    pub submitter: String,
}

/// Response type for document hash submission
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SubmitResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub anchored_at: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RevokeRequest {
    pub document_hash: String,
    pub reason: String,
    pub revoked_by: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RevokeResponse {
    pub transaction_id: String,
    pub revoked_at: i64,
    pub revoked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct HealthResponse {
    pub status: String,
    pub stellar_connected: bool,
    pub redis_connected: bool,
}

/// Response type for document verification history
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct HistoryResponse {
    pub document_hash: String,
    pub transactions: Vec<TransactionRecord>,
    pub count: usize,
    pub cached: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ValidationErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BatchVerifyRequest {
    pub hashes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BatchVerifyResponse {
    pub results: Vec<BatchVerifyItem>,
    pub total: usize,
    pub verified_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BatchVerifyItem {
    pub hash: String,
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TransferRequest {
    pub document_hash: String,
    pub from_owner: String,
    pub to_owner: String,
    pub transfer_date: String,
    pub transfer_reference: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TransferRecord {
    pub document_hash: String,
    pub from_owner: String,
    pub to_owner: String,
    pub transfer_date: String,
    pub transfer_reference: String,
    pub transfer_hash: String,
    pub memo: String,
    pub anchored_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TransferResponse {
    pub transfer_hash: String,
    pub memo: String,
}

pub fn map_validation_error(err: HashValidationError) -> (StatusCode, ValidationErrorResponse) {
    let message = match err {
        HashValidationError::EmptyHash => "hash must not be empty".to_string(),
        HashValidationError::WrongLength { expected, actual } => format!(
            "hash has wrong length: expected {} characters, got {}",
            expected, actual
        ),
        HashValidationError::InvalidCharacter {
            position,
            character,
        } => format!(
            "hash contains invalid character '{}' at position {}",
            character, position
        ),
        HashValidationError::InvalidUtf8 => "hash contains invalid UTF-8 bytes".to_string(),
    };

    (
        StatusCode::BAD_REQUEST,
        ValidationErrorResponse { error: message },
    )
}

// ── Similarity / text functions ────────────────────────────────

/// Calculates Levenshtein distance between two strings
pub fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.len();
    let len2 = s2.len();
    let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

    for (i, row) in matrix.iter_mut().enumerate() {
        row[0] = i;
    }
    for (j, cell) in matrix[0].iter_mut().enumerate() {
        *cell = j;
    }

    for (i, c1) in s1.chars().enumerate() {
        for (j, c2) in s2.chars().enumerate() {
            let cost = if c1 == c2 { 0 } else { 1 };
            matrix[i + 1][j + 1] = std::cmp::min(
                std::cmp::min(matrix[i][j + 1] + 1, matrix[i + 1][j] + 1),
                matrix[i][j] + cost,
            );
        }
    }

    matrix[len1][len2]
}

/// Normalizes Levenshtein distance to similarity score (0-1)
pub fn levenshtein_similarity(s1: &str, s2: &str) -> f64 {
    let distance = levenshtein_distance(s1, s2) as f64;
    let max_len = s1.len().max(s2.len()) as f64;
    if max_len == 0.0 {
        return 1.0;
    }
    1.0 - (distance / max_len)
}

/// Tokenizes text and calculates term frequencies
fn tokenize(text: &str) -> HashMap<String, usize> {
    let mut frequencies = HashMap::new();
    let lowercased = text.to_lowercase();
    let words: Vec<&str> = lowercased
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();

    for word in words {
        *frequencies.entry(word.to_string()).or_insert(0) += 1;
    }
    frequencies
}

/// Calculates cosine similarity between two documents
pub fn cosine_similarity(doc1: &str, doc2: &str) -> f64 {
    let freq1 = tokenize(doc1);
    let freq2 = tokenize(doc2);

    if freq1.is_empty() || freq2.is_empty() {
        return 0.0;
    }

    let mut dot_product = 0.0;
    for (word, count1) in &freq1 {
        if let Some(&count2) = freq2.get(word) {
            dot_product += (*count1 as f64) * (count2 as f64);
        }
    }

    let magnitude1: f64 = freq1
        .values()
        .map(|c| (*c as f64).powi(2))
        .sum::<f64>()
        .sqrt();
    let magnitude2: f64 = freq2
        .values()
        .map(|c| (*c as f64).powi(2))
        .sum::<f64>()
        .sqrt();

    if magnitude1 == 0.0 || magnitude2 == 0.0 {
        return 0.0;
    }

    dot_product / (magnitude1 * magnitude2)
}

/// Document similarity result
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct SimilarityResult {
    pub doc1: String,
    pub doc2: String,
    pub cosine: f64,
    pub levenshtein: f64,
    pub combined: f64,
}

/// Compares two documents and returns similarity scores
pub fn compare_documents(doc1: &str, doc2: &str) -> SimilarityResult {
    let cosine = cosine_similarity(doc1, doc2);
    let levenshtein = levenshtein_similarity(doc1, doc2);
    let combined = (cosine + levenshtein) / 2.0;

    SimilarityResult {
        doc1: doc1.to_string(),
        doc2: doc2.to_string(),
        cosine,
        levenshtein,
        combined,
    }
}

/// Batch comparison of documents against a reference
pub fn batch_compare(reference: &str, documents: &[&str]) -> Vec<SimilarityResult> {
    documents
        .iter()
        .map(|doc| compare_documents(reference, doc))
        .collect()
}

/// Finds duplicate documents above threshold
pub fn find_duplicates(documents: &[&str], threshold: f64) -> Vec<(usize, usize, f64)> {
    let mut duplicates = Vec::new();
    for i in 0..documents.len() {
        for j in (i + 1)..documents.len() {
            let similarity = compare_documents(documents[i], documents[j]).combined;
            if similarity >= threshold {
                duplicates.push((i, j, similarity));
            }
        }
    }
    duplicates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());
    duplicates
}

// ── Transfer helpers ───────────────────────────────────────────

/// Compute deterministic transfer hash from core fields.
///
/// SHA-256(document_hash + from_owner + to_owner + transfer_date)
pub fn compute_transfer_hash(req: &TransferRequest) -> String {
    let mut hasher = Sha256::new();
    hasher.update(req.document_hash.as_bytes());
    hasher.update(req.from_owner.as_bytes());
    hasher.update(req.to_owner.as_bytes());
    hasher.update(req.transfer_date.as_bytes());
    let digest = hasher.finalize();
    hex::encode(digest)
}

/// Validate that the provided date is a valid ISO 8601 calendar date (YYYY-MM-DD).
pub fn is_valid_iso8601_date(date: &str) -> bool {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}

/// Build a Stellar memo string for a transfer hash, respecting the 28-byte
/// text memo limit and using the required TRANSFER: prefix.
pub fn build_transfer_memo(transfer_hash: &str) -> String {
    const PREFIX: &str = "TRANSFER:";
    const MAX_MEMO_LEN: usize = 28;

    let remaining = MAX_MEMO_LEN.saturating_sub(PREFIX.len());
    let truncated = if transfer_hash.len() > remaining {
        &transfer_hash[..remaining]
    } else {
        transfer_hash
    };

    format!("{}{}", PREFIX, truncated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein_identical() {
        assert_eq!(levenshtein_distance("hello", "hello"), 0);
    }

    #[test]
    fn test_levenshtein_different() {
        assert_eq!(levenshtein_distance("kitten", "sitting"), 3);
    }

    #[test]
    fn test_levenshtein_similarity() {
        let sim = levenshtein_similarity("hello", "hello");
        assert!(sim >= 0.99);
    }

    #[test]
    fn test_cosine_identical() {
        let sim = cosine_similarity("hello world", "hello world");
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_different() {
        let sim = cosine_similarity("hello world", "goodbye world");
        assert!(sim > 0.0 && sim < 1.0);
    }

    #[test]
    fn test_compare_documents() {
        let result = compare_documents("the quick brown fox", "the quick brown fox");
        assert!(result.combined >= 0.99);
    }

    #[test]
    fn test_batch_compare() {
        let ref_doc = "hello world";
        let docs = vec!["hello world", "hello there", "goodbye"];
        let results = batch_compare(ref_doc, &docs);
        assert_eq!(results.len(), 3);
        assert!(results[0].combined > results[2].combined);
    }

    #[test]
    fn test_find_duplicates() {
        let docs = vec![
            "the quick brown fox jumps",
            "the quick brown fox jumps",
            "completely different text",
        ];
        let duplicates = find_duplicates(&docs, 0.8);
        assert!(!duplicates.is_empty());
        assert_eq!(duplicates[0].0, 0);
        assert_eq!(duplicates[0].1, 1);
    }

    #[test]
    fn test_transfer_hash_deterministic() {
        let req = TransferRequest {
            document_hash: "doc123".to_string(),
            from_owner: "Alice".to_string(),
            to_owner: "Bob".to_string(),
            transfer_date: "2025-01-01".to_string(),
            transfer_reference: "REF-1".to_string(),
        };

        let h1 = compute_transfer_hash(&req);
        let h2 = compute_transfer_hash(&req);

        assert_eq!(h1, h2);
    }

    #[test]
    fn test_transfer_hash_changes_with_input() {
        let base = TransferRequest {
            document_hash: "doc123".to_string(),
            from_owner: "Alice".to_string(),
            to_owner: "Bob".to_string(),
            transfer_date: "2025-01-01".to_string(),
            transfer_reference: "REF-1".to_string(),
        };

        let mut modified = base.clone();
        modified.to_owner = "Charlie".to_string();

        let h1 = compute_transfer_hash(&base);
        let h2 = compute_transfer_hash(&modified);

        assert_ne!(h1, h2);
    }

    #[test]
    fn test_iso8601_date_validation() {
        assert!(is_valid_iso8601_date("2025-12-31"));
        assert!(!is_valid_iso8601_date("2025-13-01"));
        assert!(!is_valid_iso8601_date("not-a-date"));
    }

    #[test]
    fn test_batch_verify_request_validation() {
        // Test empty batch
        let empty_request = BatchVerifyRequest { hashes: vec![] };
        assert!(empty_request.hashes.is_empty());

        // Test valid batch size
        let mut valid_hashes = Vec::new();
        for i in 0..10 {
            valid_hashes.push(format!("{:064x}", i));
        }
        let valid_request = BatchVerifyRequest {
            hashes: valid_hashes,
        };
        assert!(!valid_request.hashes.is_empty());
        assert!(valid_request.hashes.len() <= 50);

        // Test batch size exceeding limit
        let mut too_many_hashes = Vec::new();
        for i in 0..51 {
            too_many_hashes.push(format!("{:064x}", i));
        }
        let oversized_request = BatchVerifyRequest {
            hashes: too_many_hashes,
        };
        assert!(oversized_request.hashes.len() > 50);
    }

    #[test]
    fn test_batch_verify_response_structure() {
        let results = vec![
            BatchVerifyItem {
                hash: "hash1".to_string(),
                verified: true,
                transaction_id: Some("tx1".to_string()),
                timestamp: Some(1234567890),
                error: None,
            },
            BatchVerifyItem {
                hash: "hash2".to_string(),
                verified: false,
                transaction_id: None,
                timestamp: None,
                error: Some("verification failed".to_string()),
            },
        ];

        let response = BatchVerifyResponse {
            total: results.len(),
            verified_count: 1,
            failed_count: 1,
            results,
        };

        assert_eq!(response.total, 2);
        assert_eq!(response.verified_count, 1);
        assert_eq!(response.failed_count, 1);
        assert_eq!(response.results.len(), 2);

        // Verify first item
        assert_eq!(response.results[0].hash, "hash1");
        assert!(response.results[0].verified);
        assert_eq!(response.results[0].transaction_id, Some("tx1".to_string()));
        assert_eq!(response.results[0].timestamp, Some(1234567890));
        assert_eq!(response.results[0].error, None);

        // Verify second item
        assert_eq!(response.results[1].hash, "hash2");
        assert!(!response.results[1].verified);
        assert_eq!(response.results[1].transaction_id, None);
        assert_eq!(response.results[1].timestamp, None);
        assert_eq!(
            response.results[1].error,
            Some("verification failed".to_string())
        );
    }

    #[test]
    fn test_batch_verify_item_creation() {
        let item = BatchVerifyItem {
            hash: "test_hash".to_string(),
            verified: true,
            transaction_id: Some("transaction_123".to_string()),
            timestamp: Some(1640995200), // 2022-01-01 00:00:00 UTC
            error: None,
        };

        assert_eq!(item.hash, "test_hash");
        assert!(item.verified);
        assert_eq!(item.transaction_id, Some("transaction_123".to_string()));
        assert_eq!(item.timestamp, Some(1640995200));
        assert_eq!(item.error, None);
    }

    #[test]
    fn test_batch_verify_item_with_error() {
        let item = BatchVerifyItem {
            hash: "invalid_hash".to_string(),
            verified: false,
            transaction_id: None,
            timestamp: None,
            error: Some("invalid hash format".to_string()),
        };

        assert_eq!(item.hash, "invalid_hash");
        assert!(!item.verified);
        assert_eq!(item.transaction_id, None);
        assert_eq!(item.timestamp, None);
        assert_eq!(item.error, Some("invalid hash format".to_string()));
    }

    // ── Round-trip serde tests for all public types ──────────────

    fn assert_serde_round_trip<T>(original: &T)
    where
        T: Serialize + for<'de> Deserialize<'de> + PartialEq + std::fmt::Debug,
    {
        let json_string =
            serde_json::to_string(original).expect("serialization to JSON string should succeed");
        let deserialized: T = serde_json::from_str(&json_string)
            .expect("deserialization from JSON string should succeed");
        assert_eq!(
            original, &deserialized,
            "Round-trip value mismatch for JSON string"
        );

        let json_bytes =
            serde_json::to_vec(original).expect("serialization to JSON bytes should succeed");
        let deserialized_bytes: T = serde_json::from_slice(&json_bytes)
            .expect("deserialization from JSON slice should succeed");
        assert_eq!(
            original, &deserialized_bytes,
            "Round-trip value mismatch for JSON bytes"
        );
    }

    #[test]
    fn test_round_trip_verify_request() {
        let req_with_tx = VerifyRequest {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            transaction_id: Some("tx_abc123".to_string()),
        };
        assert_serde_round_trip(&req_with_tx);

        let req_without_tx = VerifyRequest {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            transaction_id: None,
        };
        assert_serde_round_trip(&req_without_tx);
    }

    #[test]
    fn test_round_trip_verify_response() {
        let resp_full = VerifyResponse {
            verified: true,
            transaction_id: Some("tx_123".to_string()),
            timestamp: Some(1700000000),
            cached: true,
            revoked: Some(false),
            revoked_at: None,
        };
        assert_serde_round_trip(&resp_full);

        let resp_revoked = VerifyResponse {
            verified: false,
            transaction_id: Some("tx_456".to_string()),
            timestamp: Some(1700000000),
            cached: false,
            revoked: Some(true),
            revoked_at: Some(1700001000),
        };
        assert_serde_round_trip(&resp_revoked);

        let resp_minimal = VerifyResponse {
            verified: false,
            transaction_id: None,
            timestamp: None,
            cached: false,
            revoked: None,
            revoked_at: None,
        };
        assert_serde_round_trip(&resp_minimal);
    }

    #[test]
    fn test_round_trip_submit_request() {
        let req = SubmitRequest {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            document_id: "doc-999".to_string(),
            submitter: "alice".to_string(),
        };
        assert_serde_round_trip(&req);
    }

    #[test]
    fn test_round_trip_submit_response() {
        let resp_success = SubmitResponse {
            success: true,
            transaction_id: Some("tx_submit_123".to_string()),
            anchored_at: Some(1700000000),
            error: None,
        };
        assert_serde_round_trip(&resp_success);

        let resp_failed = SubmitResponse {
            success: false,
            transaction_id: None,
            anchored_at: None,
            error: Some("network error".to_string()),
        };
        assert_serde_round_trip(&resp_failed);
    }

    #[test]
    fn test_round_trip_revoke_request() {
        let req = RevokeRequest {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            reason: "superseded by version 2".to_string(),
            revoked_by: "admin".to_string(),
        };
        assert_serde_round_trip(&req);
    }

    #[test]
    fn test_round_trip_revoke_response() {
        let resp = RevokeResponse {
            transaction_id: "tx_revoke_789".to_string(),
            revoked_at: 1700002000,
            revoked: true,
        };
        assert_serde_round_trip(&resp);
    }

    #[test]
    fn test_round_trip_health_response() {
        let resp_healthy = HealthResponse {
            status: "healthy".to_string(),
            stellar_connected: true,
            redis_connected: true,
        };
        assert_serde_round_trip(&resp_healthy);

        let resp_degraded = HealthResponse {
            status: "degraded".to_string(),
            stellar_connected: false,
            redis_connected: true,
        };
        assert_serde_round_trip(&resp_degraded);
    }

    #[test]
    fn test_round_trip_history_response() {
        let resp_empty = HistoryResponse {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            transactions: vec![],
            count: 0,
            cached: false,
        };
        assert_serde_round_trip(&resp_empty);

        let resp_with_records = HistoryResponse {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            transactions: vec![
                TransactionRecord {
                    transaction_id: "tx_1".to_string(),
                    timestamp: 1690000000,
                    verified: true,
                },
                TransactionRecord {
                    transaction_id: "tx_2".to_string(),
                    timestamp: 1700000000,
                    verified: true,
                },
            ],
            count: 2,
            cached: true,
        };
        assert_serde_round_trip(&resp_with_records);
    }

    #[test]
    fn test_round_trip_validation_error_response() {
        let resp = ValidationErrorResponse {
            error: "hash must not be empty".to_string(),
        };
        assert_serde_round_trip(&resp);
    }

    #[test]
    fn test_round_trip_batch_verify_request() {
        let req_empty = BatchVerifyRequest { hashes: vec![] };
        assert_serde_round_trip(&req_empty);

        let req_populated = BatchVerifyRequest {
            hashes: vec![
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".to_string(),
            ],
        };
        assert_serde_round_trip(&req_populated);
    }

    #[test]
    fn test_round_trip_batch_verify_item() {
        let item_verified = BatchVerifyItem {
            hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
            verified: true,
            transaction_id: Some("tx_batch_1".to_string()),
            timestamp: Some(1700000000),
            error: None,
        };
        assert_serde_round_trip(&item_verified);

        let item_with_error = BatchVerifyItem {
            hash: "invalid-hash".to_string(),
            verified: false,
            transaction_id: None,
            timestamp: None,
            error: Some("hash has wrong length: expected 64 characters, got 12".to_string()),
        };
        assert_serde_round_trip(&item_with_error);
    }

    #[test]
    fn test_round_trip_batch_verify_response() {
        let resp = BatchVerifyResponse {
            results: vec![
                BatchVerifyItem {
                    hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                        .to_string(),
                    verified: true,
                    transaction_id: Some("tx_1".to_string()),
                    timestamp: Some(1700000000),
                    error: None,
                },
                BatchVerifyItem {
                    hash: "invalid_hash".to_string(),
                    verified: false,
                    transaction_id: None,
                    timestamp: None,
                    error: Some("hash has wrong length: expected 64 characters, got 12".to_string()),
                },
            ],
            total: 2,
            verified_count: 1,
            failed_count: 1,
        };
        assert_serde_round_trip(&resp);
    }

    #[test]
    fn test_round_trip_transfer_request() {
        let req = TransferRequest {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            from_owner: "Alice".to_string(),
            to_owner: "Bob".to_string(),
            transfer_date: "2025-01-15".to_string(),
            transfer_reference: "REF-2025-001".to_string(),
        };
        assert_serde_round_trip(&req);
    }

    #[test]
    fn test_round_trip_transfer_record() {
        let record = TransferRecord {
            document_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                .to_string(),
            from_owner: "Alice".to_string(),
            to_owner: "Bob".to_string(),
            transfer_date: "2025-01-15".to_string(),
            transfer_reference: "REF-2025-001".to_string(),
            transfer_hash: "a1b2c3d4e5f6".to_string(),
            memo: "TRANSFER:a1b2c3d4e5f6".to_string(),
            anchored_at: "2025-01-15T12:00:00Z".to_string(),
        };
        assert_serde_round_trip(&record);
    }

    #[test]
    fn test_round_trip_transfer_response() {
        let resp = TransferResponse {
            transfer_hash: "a1b2c3d4e5f67890".to_string(),
            memo: "TRANSFER:a1b2c3d4e5f67890".to_string(),
        };
        assert_serde_round_trip(&resp);
    }

    #[test]
    fn test_round_trip_similarity_result() {
        let result = SimilarityResult {
            doc1: "Hello world".to_string(),
            doc2: "Hello earth".to_string(),
            cosine: 0.85,
            levenshtein: 0.72,
            combined: 0.785,
        };
        assert_serde_round_trip(&result);
    }

    #[test]
    fn test_all_public_types_round_trip_suite() {
        // Consolidated test verifying all 16 public data/serde types
        assert_serde_round_trip(&VerifyRequest {
            document_hash: "hash123".to_string(),
            transaction_id: Some("tx1".to_string()),
        });
        assert_serde_round_trip(&VerifyResponse {
            verified: true,
            transaction_id: Some("tx1".to_string()),
            timestamp: Some(100),
            cached: false,
            revoked: None,
            revoked_at: None,
        });
        assert_serde_round_trip(&SubmitRequest {
            document_hash: "hash123".to_string(),
            document_id: "doc1".to_string(),
            submitter: "user1".to_string(),
        });
        assert_serde_round_trip(&SubmitResponse {
            success: true,
            transaction_id: Some("tx1".to_string()),
            anchored_at: Some(100),
            error: None,
        });
        assert_serde_round_trip(&RevokeRequest {
            document_hash: "hash123".to_string(),
            reason: "revoked".to_string(),
            revoked_by: "admin".to_string(),
        });
        assert_serde_round_trip(&RevokeResponse {
            transaction_id: "tx1".to_string(),
            revoked_at: 100,
            revoked: true,
        });
        assert_serde_round_trip(&HealthResponse {
            status: "healthy".to_string(),
            stellar_connected: true,
            redis_connected: true,
        });
        assert_serde_round_trip(&HistoryResponse {
            document_hash: "hash123".to_string(),
            transactions: vec![],
            count: 0,
            cached: false,
        });
        assert_serde_round_trip(&ValidationErrorResponse {
            error: "bad request".to_string(),
        });
        assert_serde_round_trip(&BatchVerifyRequest {
            hashes: vec!["hash1".to_string()],
        });
        assert_serde_round_trip(&BatchVerifyItem {
            hash: "hash1".to_string(),
            verified: true,
            transaction_id: Some("tx1".to_string()),
            timestamp: Some(100),
            error: None,
        });
        assert_serde_round_trip(&BatchVerifyResponse {
            results: vec![],
            total: 0,
            verified_count: 0,
            failed_count: 0,
        });
        assert_serde_round_trip(&TransferRequest {
            document_hash: "hash1".to_string(),
            from_owner: "alice".to_string(),
            to_owner: "bob".to_string(),
            transfer_date: "2025-01-01".to_string(),
            transfer_reference: "ref1".to_string(),
        });
        assert_serde_round_trip(&TransferRecord {
            document_hash: "hash1".to_string(),
            from_owner: "alice".to_string(),
            to_owner: "bob".to_string(),
            transfer_date: "2025-01-01".to_string(),
            transfer_reference: "ref1".to_string(),
            transfer_hash: "thash".to_string(),
            memo: "memo".to_string(),
            anchored_at: "2025-01-01T00:00:00Z".to_string(),
        });
        assert_serde_round_trip(&TransferResponse {
            transfer_hash: "thash".to_string(),
            memo: "memo".to_string(),
        });
        assert_serde_round_trip(&SimilarityResult {
            doc1: "a".to_string(),
            doc2: "b".to_string(),
            cosine: 0.5,
            levenshtein: 0.5,
            combined: 0.5,
        });
    }
}
