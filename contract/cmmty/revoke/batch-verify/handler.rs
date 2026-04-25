use axum::{extract::State, http::StatusCode, Json};
use futures::future::join_all;

use crate::batch_verify::types::{BatchVerifyRequest, BatchVerifyResponse, HashResult};
use crate::shared::{AppError, AppState, stellar};

const MAX_BATCH_SIZE: usize = 50;

/// POST /cmmty/verify/batch
///
/// Verifies up to 50 document hashes in a single request.
///
/// For each hash:
///   1. Check the in-memory cache → cache hit: return cached result immediately.
///   2. Cache miss: fetch from Stellar, cache the result, then return it.
///
/// The response preserves the original request ordering.
pub async fn batch_verify_handler(
    State(state): State<AppState>,
    Json(payload): Json<BatchVerifyRequest>,
) -> Result<Json<BatchVerifyResponse>, AppError> {
    if payload.hashes.len() > MAX_BATCH_SIZE {
        return Err(AppError::BadRequest(format!(
            "too many hashes: maximum is {MAX_BATCH_SIZE}, got {}",
            payload.hashes.len()
        )));
    }

    // Process each hash concurrently, respecting cache
    let futures = payload.hashes.iter().map(|hash| {
        let state = state.clone();
        let hash = hash.clone();
        async move { resolve_hash(state, hash).await }
    });

    let results = join_all(futures).await;

    Ok(Json(BatchVerifyResponse { results }))
}

/// Resolve a single hash, using the cache when possible.
async fn resolve_hash(state: AppState, hash: String) -> HashResult {
    // ── 1. Cache lookup ─────────────────────────────────────────────────────
    if let Some(cached) = state.cache.get(&hash).await {
        state.metrics.cache_hits_total.inc();

        // Check if the hash has been revoked
        let revoked = cached.revoked.unwrap_or(false);
        return HashResult {
            hash,
            verified: cached.verified && !revoked,
            revoked: Some(revoked),
            tx_id: cached.tx_id,
            anchored_at: cached.anchored_at,
        };
    }

    state.metrics.cache_misses_total.inc();
    state.metrics.verify_requests_total.inc();

    // ── 2. Stellar lookup ────────────────────────────────────────────────────
    let anchor_result = stellar::fetch_manage_data(
        &state.stellar_client,
        &state.account_keypair,
        &hash,
    )
    .await;

    match anchor_result {
        Err(e) => {
            state.metrics.stellar_errors_total.inc();
            tracing::error!("Stellar error for hash {}: {}", hash, e);
            HashResult {
                hash,
                verified: false,
                revoked: None,
                tx_id: None,
                anchored_at: None,
            }
        }
        Ok(None) => {
            // Not anchored → cache negative result briefly
            state
                .cache
                .insert(
                    hash.clone(),
                    crate::shared::cache::CachedVerify {
                        verified: false,
                        revoked: None,
                        tx_id: None,
                        anchored_at: None,
                    },
                )
                .await;
            HashResult {
                hash,
                verified: false,
                revoked: Some(false),
                tx_id: None,
                anchored_at: None,
            }
        }
        Ok(Some(record)) => {
            // Check for a subsequent revocation entry
            let revoke_key = format!("revoked_{}", hash);
            let is_revoked = stellar::fetch_manage_data(
                &state.stellar_client,
                &state.account_keypair,
                &revoke_key,
            )
            .await
            .unwrap_or(None)
            .is_some();

            let result = HashResult {
                hash: hash.clone(),
                verified: !is_revoked,
                revoked: Some(is_revoked),
                tx_id: Some(record.tx_id.clone()),
                anchored_at: Some(record.timestamp.clone()),
            };

            state
                .cache
                .insert(
                    hash,
                    crate::shared::cache::CachedVerify {
                        verified: !is_revoked,
                        revoked: Some(is_revoked),
                        tx_id: Some(record.tx_id),
                        anchored_at: Some(record.timestamp),
                    },
                )
                .await;

            result
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_helpers::mock_state;
    use axum::{body::Body, http::Request};
    use serde_json::{json, Value};
    use tower::ServiceExt;

    #[tokio::test]
    async fn batch_verify_returns_400_for_more_than_50_hashes() {
        let state = mock_state().await;
        let app = crate::router(state);

        let hashes: Vec<String> = (0..=50).map(|i| format!("hash{:03}", i)).collect();
        let body = json!({ "hashes": hashes }).to_string();

        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/verify/batch")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn batch_verify_returns_result_per_hash() {
        let state = mock_state().await;
        let app = crate::router(state);

        let body = json!({ "hashes": ["aaa", "bbb", "ccc"] }).to_string();

        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/verify/batch")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        let results = json["results"].as_array().unwrap();
        assert_eq!(results.len(), 3);
    }

    #[tokio::test]
    async fn batch_verify_cache_hit_does_not_call_stellar_twice() {
        let state = mock_state().await;

        // Pre-populate cache with a known hash
        state
            .cache
            .insert(
                "cached_hash_xyz".to_string(),
                crate::shared::cache::CachedVerify {
                    verified: true,
                    revoked: Some(false),
                    tx_id: Some("txCached".to_string()),
                    anchored_at: Some("2024-06-01T00:00:00Z".to_string()),
                },
            )
            .await;

        let initial_hits = state.metrics.cache_hits_total.get() as u64;
        let initial_misses = state.metrics.cache_misses_total.get() as u64;

        let body = json!({ "hashes": ["cached_hash_xyz"] }).to_string();
        let app = crate::router(state.clone());
        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/verify/batch")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Cache hits counter should have incremented; misses should not
        assert_eq!(
            state.metrics.cache_hits_total.get() as u64,
            initial_hits + 1
        );
        assert_eq!(
            state.metrics.cache_misses_total.get() as u64,
            initial_misses
        );

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        let result = &json["results"][0];
        assert_eq!(result["verified"], true);
        assert_eq!(result["txId"], "txCached");
    }

    #[tokio::test]
    async fn batch_verify_partial_cache_hit() {
        let state = mock_state().await;

        // Only "hash_a" is cached; "hash_b" must go to Stellar
        state
            .cache
            .insert(
                "hash_a".to_string(),
                crate::shared::cache::CachedVerify {
                    verified: true,
                    revoked: Some(false),
                    tx_id: Some("txA".to_string()),
                    anchored_at: Some("2024-07-01T00:00:00Z".to_string()),
                },
            )
            .await;

        let body = json!({ "hashes": ["hash_a", "hash_b"] }).to_string();
        let app = crate::router(state.clone());
        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/verify/batch")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // One hit, one miss
        assert_eq!(state.metrics.cache_hits_total.get() as u64, 1);
        assert_eq!(state.metrics.cache_misses_total.get() as u64, 1);
    }

    #[tokio::test]
    async fn batch_verify_exact_50_hashes_accepted() {
        let state = mock_state().await;
        let app = crate::router(state);

        let hashes: Vec<String> = (0..50).map(|i| format!("hash{:03}", i)).collect();
        let body = json!({ "hashes": hashes }).to_string();

        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/verify/batch")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }
}