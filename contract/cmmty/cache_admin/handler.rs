use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use dashmap::DashMap;

use super::types::CacheResult;

#[derive(Clone)]
pub struct AppState {
    pub cache: Arc<DashMap<String, String>>,
    pub admin_key: String,
}

pub async fn delete_hash(
    Path(hash): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let removed = if state.cache.remove(&hash).is_some() { 1 } else { 0 };

    Json(CacheResult {
        invalidated: removed,
    })
}

pub async fn flush_all(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let key = headers
        .get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if key != state.admin_key {
        return Json(CacheResult { invalidated: 0 });
    }

    let count = state.cache.len();
    state.cache.clear();

    Json(CacheResult { invalidated: count })
}