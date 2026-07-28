use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{NaiveDate, Utc};
use sha2::{Digest, Sha256};
use tracing::warn;

use crate::hash_validator::HashValidator;
use crate::stellar::derive_account_id;
use crate::types::{
    map_validation_error, AppState, TransferRecord, TransferRequest, TransferResponse,
    ValidationErrorResponse,
};

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

    let anchor_account_id = derive_account_id(&state.stellar_secret_key).map_err(|e| {
        warn!("Failed to derive anchor account id: {}", e);
        state.metrics.increment_error_count();
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Err(e) = state
        .stellar
        .anchor_transfer(
            &transfer_hash,
            &anchor_account_id,
            &state.stellar_secret_key,
        )
        .await
    {
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

    Ok(Json(TransferResponse {
        transfer_hash,
        memo,
    }))
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

pub async fn transfer_document(Json(req): Json<TransferRequest>) -> impl IntoResponse {
    let normalized_hash = HashValidator::normalize(&req.document_hash);
    if let Err(err) = HashValidator::validate_sha256(&normalized_hash) {
        let (status, body) = map_validation_error(err);
        return (status, Json(body));
    }

    // Basic date validation: expect YYYY-MM-DD
    if chrono::NaiveDate::parse_from_str(&req.transfer_date, "%Y-%m-%d").is_err() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ValidationErrorResponse {
                error: "invalid date format, expected YYYY-MM-DD".to_string(),
            }),
        );
    }

    (
        StatusCode::BAD_REQUEST,
        Json(ValidationErrorResponse {
            error: "transfer endpoint not yet implemented".to_string(),
        }),
    )
}
