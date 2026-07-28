use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use futures::future::join_all;
use tracing::{info, warn};

use crate::hash_validator::{HashValidator, ValidationError as HashValidationError};
use crate::stellar::derive_account_id;
use crate::types::{
    map_validation_error, AppState, BatchVerifyItem, BatchVerifyRequest, BatchVerifyResponse,
    HistoryResponse, VerifyRequest, VerifyResponse, ValidationErrorResponse,
};

// Verify document by POST
pub async fn verify_document(
    State(state): State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> Response {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body)).into_response();
    }

    info!("Verifying document hash: {}", normalized_hash);
    state.metrics.increment_request_count();

    // Check cache first
    if let Ok(Some(cached)) = state.cache.get::<VerifyResponse>(&normalized_hash).await {
        info!("Cache hit for hash: {}", normalized_hash);
        state.metrics.increment_cache_hits();
        return Json(cached).into_response();
    }

    state.metrics.increment_cache_misses();

    let anchor_account_id = match derive_account_id(&state.stellar_secret_key) {
        Ok(id) => id,
        Err(e) => {
            warn!("Failed to derive anchor account id: {}", e);
            state.metrics.increment_error_count();
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Query Stellar blockchain
    let result = match state
        .stellar
        .verify_hash(&normalized_hash, &anchor_account_id)
        .await
    {
        Ok(verification) => verification,
        Err(e) => {
            warn!("Stellar query failed: {}", e);
            state.metrics.increment_error_count();
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let response = VerifyResponse {
        verified: result.anchored,
        transaction_id: result.transaction_id,
        timestamp: result.timestamp,
        cached: false,
        revoked: None,
        revoked_at: None,
    };

    Json(response).into_response()
}

// Verify document by GET with hash in path
pub async fn verify_document_by_hash(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Response {
    let req = VerifyRequest {
        document_hash: hash,
        transaction_id: None,
    };
    verify_document(State(state), Json(req)).await
}

// Verify document history by hash
pub async fn verify_document_history(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Response {
    let normalized_hash = HashValidator::normalize(&hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body)).into_response();
    }

    let cache_key = format!("history:{}", normalized_hash);
    let transactions: Vec<crate::stellar::TransactionRecord> =
        match state.cache.get(&cache_key).await {
            Ok(Some(records)) => records,
            Ok(None) => Vec::new(),
            Err(e) => {
                warn!("Failed to fetch history from cache: {}", e);
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        };

    let count = transactions.len();
    let cached = !transactions.is_empty();

    Json(HistoryResponse {
        document_hash: normalized_hash,
        transactions,
        count,
        cached,
    })
    .into_response()
}

// Batch verify documents
pub async fn batch_verify_documents(
    State(state): State<AppState>,
    Json(req): Json<BatchVerifyRequest>,
) -> Response {
    // Validate batch size
    if req.hashes.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidationErrorResponse {
                error: "hashes array cannot be empty".to_string(),
            }),
        )
            .into_response();
    }

    if req.hashes.len() > 50 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidationErrorResponse {
                error: "batch size exceeds maximum of 50 hashes".to_string(),
            }),
        )
            .into_response();
    }

    info!("Batch verifying {} document hashes", req.hashes.len());
    state.metrics.increment_request_count();

    // Process all hashes concurrently
    let verification_futures: Vec<_> = req
        .hashes
        .iter()
        .map(|hash| {
            let state = state.clone();
            let hash = hash.clone();

            async move { verify_single_hash(&state, hash).await }
        })
        .collect();

    let results = join_all(verification_futures).await;

    let verified_count = results.iter().filter(|item| item.verified).count();
    let failed_count = results.len() - verified_count;

    let response = BatchVerifyResponse {
        results,
        total: req.hashes.len(),
        verified_count,
        failed_count,
    };

    Json(response).into_response()
}

// Helper function to verify a single hash
pub async fn verify_single_hash(state: &AppState, hash: String) -> BatchVerifyItem {
    let normalized_hash = HashValidator::normalize(&hash);

    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let error_msg = match err {
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

    let anchor_account_id = match derive_account_id(&state.stellar_secret_key) {
        Ok(id) => id,
        Err(e) => {
            warn!("Failed to derive anchor account id: {}", e);
            state.metrics.increment_error_count();

            return BatchVerifyItem {
                hash,
                verified: false,
                transaction_id: None,
                timestamp: None,
                error: Some(format!("failed to derive anchor account id: {}", e)),
            };
        }
    };

    // Query Stellar blockchain
    let result = match state
        .stellar
        .verify_hash(&normalized_hash, &anchor_account_id)
        .await
    {
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
        verified: result.anchored,
        transaction_id: result.transaction_id.clone(),
        timestamp: result.timestamp,
        cached: false,
        revoked: None,
        revoked_at: None,
    };

    if let Err(e) = state
        .cache
        .set(&normalized_hash, &cache_response, 3600)
        .await
    {
        warn!("Failed to cache result for hash {}: {}", normalized_hash, e);
    }

    BatchVerifyItem {
        hash,
        verified: result.anchored,
        transaction_id: result.transaction_id,
        timestamp: result.timestamp,
        error: None,
    }
}
