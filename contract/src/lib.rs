pub mod cache;
pub mod config;
pub mod metrics;
pub mod rate_limit;
pub mod stellar;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use cache::{CacheBackend};
use config::AppConfig;
use metrics::MetricsRegistry;
use stellar::StellarClient;

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

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_handler))
        .route("/verify", post(verify_document))
        .route("/verify/:hash", get(verify_document_by_hash))
        .route("/revoke", post(revoke_document))
        // Stubs for missing endpoints
        .route("/verify/batch", post(|| async { StatusCode::BAD_REQUEST }))
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

// Verify document by POST
pub async fn verify_document(
    State(state): State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, StatusCode> {
    info!("Verifying document hash: {}", req.document_hash);
    state.metrics.increment_request_count();

    // Check cache first
    if let Ok(Some(cached)) = state.cache.get(&req.document_hash).await {
        info!("Cache hit for hash: {}", req.document_hash);
        state.metrics.increment_cache_hits();
        return Ok(Json(cached));
    }

    state.metrics.increment_cache_misses();

    // Query Stellar blockchain
    let result = match state.stellar.verify_hash(&req.document_hash).await {
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
    if let Err(e) = state.cache.set(&req.document_hash, &response, 3600).await {
        warn!("Failed to cache result: {}", e);
    }

    Ok(Json(response))
}

// Verify document by GET with hash in path
pub async fn verify_document_by_hash(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<VerifyResponse>, StatusCode> {
    let req = VerifyRequest {
        document_hash: hash,
        transaction_id: None,
    };
    verify_document(State(state), Json(req)).await
}

// Revoke document endpoint
pub async fn revoke_document(
    State(state): State<AppState>,
    Json(req): Json<RevokeRequest>,
) -> Result<Json<RevokeResponse>, (StatusCode, Json<serde_json::Value>)> {
    info!("Revoking document hash: {}", req.document_hash);
    state.metrics.increment_request_count();

    // Verify that the hash exists on-chain first
    let verification = match state.stellar.verify_hash(&req.document_hash).await {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to verify hash before revocation: {}", e);
            state.metrics.increment_error_count();
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to verify hash existence",
                    "message": e.to_string()
                }))
            ));
        }
    };

    // If hash not found on-chain, return 404
    if !verification.verified {
        info!("Hash not found on-chain: {}", req.document_hash);
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Document hash not found",
                "message": format!("The document hash '{}' does not exist on the blockchain", req.document_hash)
            }))
        ));
    }

    // Submit revocation to Stellar
    let transaction_id = match state.stellar.revoke_hash(
        &req.document_hash,
        &req.reason,
        &req.revoked_by
    ).await {
        Ok(tx_id) => tx_id,
        Err(e) => {
            warn!("Failed to submit revocation: {}", e);
            state.metrics.increment_error_count();
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to submit revocation",
                    "message": e.to_string()
                }))
            ));
        }
    };

    // Invalidate cache for this hash
    if let Err(e) = state.cache.delete(&req.document_hash).await {
        warn!("Failed to invalidate cache for revoked hash: {}", e);
        // Don't fail the request if cache invalidation fails
    }

    let revoked_at = chrono::Utc::now().timestamp();

    info!("Document revoked successfully: {}", transaction_id);

    Ok(Json(RevokeResponse {
        transaction_id,
        revoked_at,
    }))
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
}
