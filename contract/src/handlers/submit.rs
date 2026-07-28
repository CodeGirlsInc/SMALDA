use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use tracing::{info, warn};

use crate::hash_validator::HashValidator;
use crate::types::{map_validation_error, AppState, SubmitRequest, SubmitResponse};

/// POST /submit — anchor a document hash to Stellar using a ManageData operation.
///
/// Request body: `{ document_hash, document_id, submitter }`
///
/// On success returns `{ success: true, transaction_id, anchored_at }`.
/// Duplicate submissions return the cached result with `200 OK` (idempotent).
pub async fn submit_document(
    State(state): State<AppState>,
    Json(req): Json<SubmitRequest>,
) -> Response {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body)).into_response();
    }

    let cache_key = format!("stellar:verify:{}", normalized_hash);

    // Idempotency check — return cached anchor result if it exists.
    if let Ok(Some(cached)) = state.cache.get::<SubmitResponse>(&cache_key).await {
        info!(
            "Cache hit for submit: returning existing anchor for {}",
            normalized_hash
        );
        return Json(cached).into_response();
    }

    info!(
        "Anchoring document hash {} submitted by {}",
        normalized_hash, req.submitter
    );
    state.metrics.increment_request_count();

    match state
        .stellar
        .anchor_hash(&normalized_hash, &req.submitter, &state.stellar_secret_key)
        .await
    {
        Ok(result) => {
            let response = SubmitResponse {
                success: true,
                transaction_id: Some(result.tx_hash.clone()),
                anchored_at: Some(result.anchored_at),
                error: None,
            };

            // Cache the result so duplicate submissions get a fast 200.
            const ANCHOR_CACHE_TTL: u64 = 60 * 60 * 24 * 365; // 1 year
            if let Err(e) = state
                .cache
                .set(&cache_key, &response, ANCHOR_CACHE_TTL)
                .await
            {
                warn!(
                    "Failed to cache anchor result for {}: {}",
                    normalized_hash, e
                );
            }

            info!(
                "Document hash {} anchored in ledger {} (tx: {})",
                normalized_hash, result.ledger, result.tx_hash
            );
            Json(response).into_response()
        }
        Err(e) => {
            warn!("Stellar anchor failed for {}: {}", normalized_hash, e);
            state.metrics.increment_error_count();
            (
                StatusCode::BAD_GATEWAY,
                Json(SubmitResponse {
                    success: false,
                    transaction_id: None,
                    anchored_at: None,
                    error: Some(e.to_string()),
                }),
            )
                .into_response()
        }
    }
}
