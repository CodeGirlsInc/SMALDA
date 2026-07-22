use chrono::Utc;
use serde_json;
use crate::models::transfer::{TransferPayload, TransferResponse};
use crate::errors::AppError;

pub fn build_transfer_key(hash: &str, counter: u32) -> String {
    let truncated_hash = if hash.len() > 50 {
        &hash[..50]
    } else {
        hash
    };
    
    if counter > 0 {
        format!("tr_{}_{}", truncated_hash, counter)
    } else {
        format!("transfer_{}", truncated_hash)
    }
}

pub async fn record_transfer_on_stellar(
    hash: &str,
    from_public_key: &str,
    to_public_key: &str,
    reason: Option<String>,
    counter: u32,
    stellar_client: &StellarClient,
) -> Result<TransferResponse, AppError> {
    let transferred_at = Utc::now().to_rfc3339();

    let key = build_transfer_key(hash, counter);

    let payload = TransferPayload {
        from_public_key: from_public_key.to_string(),
        to_public_key: to_public_key.to_string(),
        transferred_at: transferred_at.clone(),
        reason,
    };

    let value_bytes = serde_json::to_vec(&payload)
        .map_err(|e| AppError::Internal(format!("Serialization error: {}", e)))?;

    // Build and submit Stellar ManageData transaction
    let (tx_hash, ledger) = stellar_client
        .submit_manage_data(&key, Some(value_bytes))
        .await
        .map_err(|e| AppError::StellarTxFailed(e.to_string()))?;

    Ok(TransferResponse {
        tx_hash,
        ledger,
        transferred_at,
    })
}