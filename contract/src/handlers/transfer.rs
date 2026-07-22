use actix_web::{web, HttpResponse, Responder};
use redis::AsyncCommands;
use serde_json::json;

use crate::{
    errors::AppError,
    models::transfer::{TransferHistoryResponse, TransferRecord, TransferRequest},
    stellar::transfer::{build_transfer_key, record_transfer_on_stellar},
    state::AppState,
};

/// POST /transfer
pub async fn transfer_handler(
    state: web::Data<AppState>,
    req: web::Json<TransferRequest>,
) -> Result<impl Responder, AppError> {
    let mut redis_conn = state.redis_pool.get().await.map_err(|e| {
        AppError::Internal(format!("Failed to acquire Redis connection: {}", e))
    })?;

    // 1. Verify document is anchored first (Return 404 if not found)
    let redis_key = format!("doc:{}", req.hash);
    let anchor_exists: bool = redis_conn
        .exists(&redis_key)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !anchor_exists {
        return Err(AppError::NotFound(format!(
            "No anchor record found for document hash: {}",
            req.hash
        )));
    }

    // 2. Fetch current transfer count to generate key
    let counter_key = format!("doc:{}:transfer_count", req.hash);
    let counter: u32 = redis_conn.get(&counter_key).await.unwrap_or(0);

    // 3. Record ManageData entry on Stellar
    let res = record_transfer_on_stellar(
        &req.hash,
        &req.from_public_key,
        &req.to_public_key,
        req.reason.clone(),
        counter,
        &state.stellar_client,
    )
    .await?;

    // 4. Update Redis cache with latest owner and increment counter
    redis_conn
        .hset(&redis_key, "owner", &req.to_public_key)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    redis_conn
        .incr::<_, _, ()>(&counter_key, 1)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(HttpResponse::Ok().json(res))
}

/// GET /verify/{hash}/history
pub async fn transfer_history_handler(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<impl Responder, AppError> {
    let hash = path.into_inner();
    let mut redis_conn = state.redis_pool.get().await.map_err(|e| {
        AppError::Internal(format!("Failed to acquire Redis connection: {}", e))
    })?;

    // Verify document exists
    let redis_key = format!("doc:{}", hash);
    let anchor_exists: bool = redis_conn
        .exists(&redis_key)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !anchor_exists {
        return Err(AppError::NotFound(format!(
            "No anchor record found for document hash: {}",
            hash
        )));
    }

    // Fetch all transfer records sequentially from Stellar/Data entries
    let counter_key = format!("doc:{}:transfer_count", hash);
    let counter: u32 = redis_conn.get(&counter_key).await.unwrap_or(0);

    let mut history = Vec::new();

    for i in 0..counter {
        let key = build_transfer_key(&hash, i);
        if let Ok(Some(record)) = state.stellar_client.fetch_manage_data_record::<TransferRecord>(&key).await {
            history.push(record);
        }
    }

    Ok(HttpResponse::Ok().json(TransferHistoryResponse {
        hash,
        total_transfers: history.len(),
        history,
    }))
}