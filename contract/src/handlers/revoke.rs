use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use tracing::{info, warn};

use crate::hash_validator::HashValidator;
use crate::types::{
    map_validation_error, AppState, RevokeRequest, RevokeResponse, SubmitResponse,
    ValidationErrorResponse,
};

/// POST /revoke — record a document revocation on Stellar.
///
/// Writes a `ManageData` entry with key `"revoked_" + hash[:56]` and
/// value `{ revokedAt, reason }` as bytes.  The original `doc_` entry is
/// preserved so audit history remains intact.
///
/// After a successful on-chain revocation the Redis cache entry for
/// `stellar:verify:{hash}` is updated so that subsequent `GET /verify/:hash`
/// calls return `{ verified: true, revoked: true, revokedAt }`.
///
/// Returns `404` if the hash has no prior anchor record.
pub async fn revoke_document(
    State(state): State<AppState>,
    Json(req): Json<RevokeRequest>,
) -> Response {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body)).into_response();
    }

    let anchor_key = format!("stellar:verify:{}", normalized_hash);

    // Ensure the document was previously anchored before revoking.
    let existing: Option<SubmitResponse> = state
        .cache
        .get::<SubmitResponse>(&anchor_key)
        .await
        .unwrap_or(None);

    if existing.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(ValidationErrorResponse {
                error: "document hash has no prior anchor record; cannot revoke".to_string(),
            }),
        )
            .into_response();
    }

    info!(
        "Revoking document hash {} (revoked_by: {})",
        normalized_hash, req.revoked_by
    );
    state.metrics.increment_request_count();

    let revoked_at = Utc::now().timestamp();

    // Build the revocation payload stored as ManageData value.
    let revocation_value = serde_json::json!({
        "revokedAt": Utc::now().to_rfc3339(),
        "reason": req.reason,
        "revokedBy": req.revoked_by,
    })
    .to_string();

    // Use stellar.rs anchor_hash logic directly — we build a new ManageData tx
    // with the revocation key.
    match state
        .stellar
        .anchor_revocation(
            &normalized_hash,
            &revocation_value,
            &req.revoked_by,
            &state.stellar_secret_key,
        )
        .await
    {
        Ok(result) => {
            // Update the cached verify entry to reflect revocation.
            let updated_verify = crate::types::VerifyResponse {
                verified: true,
                transaction_id: existing.and_then(|r| r.transaction_id),
                timestamp: Some(revoked_at),
                cached: false,
                revoked: Some(true),
                revoked_at: Some(revoked_at),
            };
            const REVOKE_CACHE_TTL: u64 = 60 * 60 * 24 * 365;
            if let Err(e) = state
                .cache
                .set(&anchor_key, &updated_verify, REVOKE_CACHE_TTL)
                .await
            {
                warn!("Failed to update cache after revocation: {}", e);
            }

            info!(
                "Document {} revoked in ledger {} (tx: {})",
                normalized_hash, result.ledger, result.tx_hash
            );

            Json(RevokeResponse {
                transaction_id: result.tx_hash,
                revoked_at,
                revoked: true,
            })
            .into_response()
        }
        Err(e) => {
            warn!("Revocation failed for {}: {}", normalized_hash, e);
            state.metrics.increment_error_count();
            (
                StatusCode::BAD_GATEWAY,
                Json(ValidationErrorResponse {
                    error: format!("Stellar revocation failed: {}", e),
                }),
            )
                .into_response()
        }
    }
}
