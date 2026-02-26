pub mod cache;
pub mod config;
pub mod metrics;
pub mod rate_limit;
pub mod stellar;
pub mod hash_validator;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use futures::future::join_all;

use cache::CacheBackend;
use metrics::MetricsRegistry;
use stellar::StellarClient;
use hash_validator::{HashValidator, ValidationError as HashValidationError};

// Application state
#[derive(Clone)]
pub struct AppState {
    pub stellar: Arc<StellarClient>,
    pub cache: Arc<CacheBackend>,
    pub metrics: Arc<MetricsRegistry>,
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
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub document_hash: String,
    pub reason: String,
    pub revoked_by: String,
}

#[derive(Debug, Serialize)]
pub struct RevokeResponse {
    pub transaction_id: String,
    pub revoked_at: i64,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub stellar_connected: bool,
    pub redis_connected: bool,
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

fn map_validation_error(err: HashValidationError) -> (StatusCode, ValidationErrorResponse) {
    let message = match err {
        HashValidationError::EmptyHash => "hash must not be empty".to_string(),
        HashValidationError::WrongLength { expected, actual } => format!(
            "hash has wrong length: expected {} characters, got {}",
            expected, actual
        ),
        HashValidationError::InvalidCharacter { position, character } => format!(
            "hash contains invalid character '{}' at position {}",
            character, position
        ),
    };

    (
        StatusCode::BAD_REQUEST,
        ValidationErrorResponse { error: message },
    )
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_handler))
        .route("/verify", post(verify_document))
        .route("/verify/:hash", get(verify_document_by_hash))
        .route("/revoke", post(revoke_document))
        // Stubs for missing endpoints
        .route("/verify/batch", post(batch_verify_documents))
        .route("/verify/:hash/history", get(|| async { StatusCode::NOT_FOUND }))
        .route("/submit", post(|| async { StatusCode::BAD_REQUEST }))
        .route("/transfer", post(|| async { StatusCode::BAD_REQUEST }))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

// Health check endpoint
pub async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let stellar_ok = state.stellar.check_connection().await;
    let redis_ok = state.cache.check_connection().await;

    let status = if stellar_ok && redis_ok {
        "healthy"
    } else {
        "degraded"
    };

    Json(HealthResponse {
        status: status.to_string(),
        stellar_connected: stellar_ok,
        redis_connected: redis_ok,
    })
}

// Metrics endpoint
pub async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    state.metrics.render()
}

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
fn is_valid_iso8601_date(date: &str) -> bool {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}

/// Build a Stellar memo string for a transfer hash, respecting the 28-byte
/// text memo limit and using the required TRANSFER: prefix.
fn build_transfer_memo(transfer_hash: &str) -> String {
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

/// POST /transfer — anchor an ownership transfer on Stellar and persist history in Redis.
pub async fn record_transfer(
    State(state): State<AppState>,
    Json(req): Json<TransferRequest>,
) -> Result<Json<TransferResponse>, StatusCode> {
    if !is_valid_iso8601_date(&req.transfer_date) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let transfer_hash = compute_transfer_hash(&req);
    let memo = build_transfer_memo(&transfer_hash);

    if let Err(e) = state.stellar.anchor_transfer(&transfer_hash, &memo).await {
        warn!("Failed to anchor transfer on Stellar: {}", e);
        state.metrics.increment_error_count();
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let record = TransferRecord {
        document_hash: req.document_hash.clone(),
        from_owner: req.from_owner.clone(),
        to_owner: req.to_owner.clone(),
        transfer_date: req.transfer_date.clone(),
        transfer_reference: req.transfer_reference.clone(),
        transfer_hash: transfer_hash.clone(),
        memo: memo.clone(),
        anchored_at: Utc::now().to_rfc3339(),
    };

    let key = format!("transfer:{}", record.document_hash);

    let mut history: Vec<TransferRecord> = match state.cache.get(&key).await {
        Ok(Some(existing)) => existing,
        Ok(None) => Vec::new(),
        Err(e) => {
            warn!("Failed to read transfer history from cache: {}", e);
            state.metrics.increment_error_count();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    history.push(record);

    // Set a long but finite TTL (10 years) to keep an auditable history
    const TEN_YEARS_SECONDS: u64 = 60 * 60 * 24 * 365 * 10;
    if let Err(e) = state.cache.set(&key, &history, TEN_YEARS_SECONDS).await {
        warn!("Failed to persist transfer history: {}", e);
        state.metrics.increment_error_count();
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(Json(TransferResponse { transfer_hash, memo }))
}

/// GET /transfer/:document_hash — retrieve transfer history for a document.
pub async fn get_transfer_history(
    State(state): State<AppState>,
    Path(document_hash): Path<String>,
) -> Result<Json<Vec<TransferRecord>>, StatusCode> {
    let key = format!("transfer:{}", document_hash);
    match state.cache.get::<Vec<TransferRecord>>(&key).await {
        Ok(Some(history)) => Ok(Json(history)),
        Ok(None) => Ok(Json(Vec::new())),
        Err(e) => {
            warn!("Failed to fetch transfer history from cache: {}", e);
            state.metrics.increment_error_count();
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Verify document by POST
pub async fn verify_document(
    State(state): State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return Ok((status, Json(body)));
    }

    info!("Verifying document hash: {}", normalized_hash);
    state.metrics.increment_request_count();

    // Check cache first
    if let Ok(Some(cached)) = state.cache.get(&normalized_hash).await {
        info!("Cache hit for hash: {}", normalized_hash);
        state.metrics.increment_cache_hits();
        return Ok(Json(cached));
    }

    state.metrics.increment_cache_misses();

    // Query Stellar blockchain
    let result = match state.stellar.verify_hash(&normalized_hash).await {
        Ok(verification) => verification,
        Err(e) => {
            warn!("Stellar query failed: {}", e);
            state.metrics.increment_error_count();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let response = VerifyResponse {
        verified: result.verified,
        transaction_id: result.transaction_id,
        timestamp: result.timestamp,
        cached: false,
    };

    // Cache result
    if let Err(e) = state.cache.set(&normalized_hash, &response, 3600).await {
        warn!("Failed to cache result: {}", e);
    }

    Ok(Json(response))
}

// Verify document by GET with hash in path
pub async fn verify_document_by_hash(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let req = VerifyRequest {
        document_hash: hash,
        transaction_id: None,
    };
    verify_document(State(state), Json(req)).await
}

// Batch verify documents
pub async fn batch_verify_documents(
    State(state): State<AppState>,
    Json(req): Json<BatchVerifyRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Validate batch size
    if req.hashes.is_empty() {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(ValidationErrorResponse {
                error: "hashes array cannot be empty".to_string(),
            }),
        ));
    }

    if req.hashes.len() > 50 {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(ValidationErrorResponse {
                error: "batch size exceeds maximum of 50 hashes".to_string(),
            }),
        ));
    }

    info!("Batch verifying {} document hashes", req.hashes.len());
    state.metrics.increment_request_count();

    // Process all hashes concurrently
    let verification_futures: Vec<_> = req.hashes.iter().map(|hash| {
        let state = state.clone();
        let hash = hash.clone();
        
        async move {
            verify_single_hash(&state, hash).await
        }
    }).collect();

    let results = join_all(verification_futures).await;
    
    let verified_count = results.iter().filter(|item| item.verified).count();
    let failed_count = results.len() - verified_count;

    let response = BatchVerifyResponse {
        results,
        total: req.hashes.len(),
        verified_count,
        failed_count,
    };

    Ok(Json(response))
}

// Helper function to verify a single hash
async fn verify_single_hash(state: &AppState, hash: String) -> BatchVerifyItem {
    // Normalize and validate hash
    let normalized_hash = match HashValidator::normalize(&hash) {
        Ok(h) => h,
        Err(_) => {
            return BatchVerifyItem {
                hash,
                verified: false,
                transaction_id: None,
                timestamp: None,
                error: Some("invalid hash format".to_string()),
            };
        }
    };

    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let error_msg = match err {
            HashValidationError::EmptyHash => "hash must not be empty".to_string(),
            HashValidationError::WrongLength { expected, actual } => format!(
                "hash has wrong length: expected {} characters, got {}",
                expected, actual
            ),
            HashValidationError::InvalidCharacter { position, character } => format!(
                "hash contains invalid character '{}' at position {}",
                character, position
            ),
        };

        return BatchVerifyItem {
            hash,
            verified: false,
            transaction_id: None,
            timestamp: None,
            error: Some(error_msg),
        };
    }

    // Check cache first
    if let Ok(Some(cached)) = state.cache.get::<VerifyResponse>(&normalized_hash).await {
        info!("Cache hit for hash: {}", normalized_hash);
        state.metrics.increment_cache_hits();
        
        return BatchVerifyItem {
            hash,
            verified: cached.verified,
            transaction_id: cached.transaction_id,
            timestamp: cached.timestamp,
            error: None,
        };
    }

    state.metrics.increment_cache_misses();

    // Query Stellar blockchain
    let result = match state.stellar.verify_hash(&normalized_hash).await {
        Ok(verification) => verification,
        Err(e) => {
            warn!("Stellar query failed for hash {}: {}", normalized_hash, e);
            state.metrics.increment_error_count();
            
            return BatchVerifyItem {
                hash,
                verified: false,
                transaction_id: None,
                timestamp: None,
                error: Some(format!("stellar query failed: {}", e)),
            };
        }
    };

    // Cache the result
    let cache_response = VerifyResponse {
        verified: result.verified,
        transaction_id: result.transaction_id.clone(),
        timestamp: result.timestamp,
        cached: false,
    };

    if let Err(e) = state.cache.set(&normalized_hash, &cache_response, 3600).await {
        warn!("Failed to cache result for hash {}: {}", normalized_hash, e);
    }

    BatchVerifyItem {
        hash,
        verified: result.verified,
        transaction_id: result.transaction_id,
        timestamp: result.timestamp,
        error: None,
    }
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub document_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub document_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct TransferRequest {
    pub document_hash: String,
    pub date: String,
}

pub async fn submit_document(
    Json(req): Json<SubmitRequest>,
) -> impl IntoResponse {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body));
    }

    // Endpoint behavior not yet implemented; preserve previous BAD_REQUEST semantics.
    (
        StatusCode::BAD_REQUEST,
        Json(ValidationErrorResponse {
            error: "submit endpoint not yet implemented".to_string(),
        }),
    )
}

pub async fn revoke_document(
    Json(req): Json<RevokeRequest>,
) -> impl IntoResponse {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body));
    }

    // Endpoint behavior not yet implemented; preserve previous NOT_FOUND semantics.
    (
        StatusCode::NOT_FOUND,
        Json(ValidationErrorResponse {
            error: "revoke endpoint not yet implemented".to_string(),
        }),
    )
}

pub async fn transfer_document(
    Json(req): Json<TransferRequest>,
) -> impl IntoResponse {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body));
    }

    // Basic date validation: expect YYYY-MM-DD
    if chrono::NaiveDate::parse_from_str(&req.date, "%Y-%m-%d").is_err() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidationErrorResponse {
                error: "invalid date format, expected YYYY-MM-DD".to_string(),
            }),
        );
    }

    // Endpoint behavior not yet implemented; for now respond with BAD_REQUEST.
    (
        StatusCode::BAD_REQUEST,
        Json(ValidationErrorResponse {
            error: "transfer endpoint not yet implemented".to_string(),
        }),
    )
}

/// Calculates Levenshtein distance between two strings
pub fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.len();
    let len2 = s2.len();
    let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

    for i in 0..=len1 {
        matrix[i][0] = i;
    }
    for j in 0..=len2 {
        matrix[0][j] = j;
    }

    for (i, c1) in s1.chars().enumerate() {
        for (j, c2) in s2.chars().enumerate() {
            let cost = if c1 == c2 { 0 } else { 1 };
            matrix[i + 1][j + 1] = std::cmp::min(
                std::cmp::min(
                    matrix[i][j + 1] + 1,
                    matrix[i + 1][j] + 1,
                ),
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

    let magnitude1: f64 = freq1.values().map(|c| (*c as f64).powi(2)).sum::<f64>().sqrt();
    let magnitude2: f64 = freq2.values().map(|c| (*c as f64).powi(2)).sum::<f64>().sqrt();

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
        assert!(duplicates.len() > 0);
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
        let valid_request = BatchVerifyRequest { hashes: valid_hashes };
        assert!(!valid_request.hashes.is_empty());
        assert!(valid_request.hashes.len() <= 50);

        // Test batch size exceeding limit
        let mut too_many_hashes = Vec::new();
        for i in 0..51 {
            too_many_hashes.push(format!("{:064x}", i));
        }
        let oversized_request = BatchVerifyRequest { hashes: too_many_hashes };
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
        assert_eq!(response.results[0].verified, true);
        assert_eq!(response.results[0].transaction_id, Some("tx1".to_string()));
        assert_eq!(response.results[0].timestamp, Some(1234567890));
        assert_eq!(response.results[0].error, None);
        
        // Verify second item
        assert_eq!(response.results[1].hash, "hash2");
        assert_eq!(response.results[1].verified, false);
        assert_eq!(response.results[1].transaction_id, None);
        assert_eq!(response.results[1].timestamp, None);
        assert_eq!(response.results[1].error, Some("verification failed".to_string()));
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
