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
#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub document_hash: String,
    pub transaction_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
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
#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub document_hash: String,
    pub document_id: String,
    pub submitter: String,
}

/// Response type for document hash submission
#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub anchored_at: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub document_hash: String,
    pub reason: String,
    pub revoked_by: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RevokeResponse {
    pub transaction_id: String,
    pub revoked_at: i64,
    pub revoked: bool,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub stellar_connected: bool,
    pub redis_connected: bool,
}

/// Response type for document verification history
#[derive(Debug, Serialize)]
pub struct HistoryResponse {
    pub document_hash: String,
    pub transactions: Vec<TransactionRecord>,
    pub count: usize,
    pub cached: bool,
}

#[derive(Debug, Serialize)]
pub struct ValidationErrorResponse {
    pub error: String,
}

#[derive(Debug, Deserialize)]
pub struct BatchVerifyRequest {
    pub hashes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct BatchVerifyResponse {
    pub results: Vec<BatchVerifyItem>,
    pub total: usize,
    pub verified_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Serialize)]
pub struct BatchVerifyItem {
    pub hash: String,
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TransferRequest {
    pub document_hash: String,
    pub from_owner: String,
    pub to_owner: String,
    pub transfer_date: String,
    pub transfer_reference: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize)]
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
#[derive(Debug, Clone)]
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
}
