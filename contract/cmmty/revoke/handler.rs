use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc;
use serde_json::json;

use crate::revoke::types::{RevokeRequest, RevokeResponse};
use crate::shared::{AppError, AppState, stellar};

/// POST /cmmty/revoke
///
/// Marks a previously anchored document hash as revoked by writing a
/// `manageData` operation to Stellar with the key `revoked_<hash>`.
pub async fn revoke_handler(
    State(state): State<AppState>,
    Json(payload): Json<RevokeRequest>,
) -> Result<Json<RevokeResponse>, AppError> {
    let hash = payload.hash.trim().to_string();

    if hash.is_empty() {
        return Err(AppError::BadRequest("hash must not be empty".into()));
    }

    // Increment Prometheus counters (no-op if metrics feature is disabled)
    state.metrics.anchor_requests_total.inc();

    let manage_data_key = format!("revoked_{}", hash);

    // Write revocation record to Stellar via manageData
    let tx_hash = stellar::write_manage_data(
        &state.stellar_client,
        &state.account_keypair,
        &manage_data_key,
        // value: RFC-3339 timestamp at the moment of revocation
        Some(Utc::now().to_rfc3339().as_bytes().to_vec()),
    )
    .await
    .map_err(|e| {
        state.metrics.stellar_errors_total.inc();
        AppError::StellarError(e.to_string())
    })?;

    let revoked_at = Utc::now();

    // Invalidate any cached verify result for this hash so subsequent
    // verify calls re-fetch from Stellar and see the revocation.
    state.cache.invalidate(&hash).await;

    let response = RevokeResponse {
        tx_hash,
        revoked_at: revoked_at.to_rfc3339(),
    };

    Ok(Json(response))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_helpers::{mock_state, make_request};
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt; // for `.oneshot()`

    #[tokio::test]
    async fn revoke_returns_tx_hash_and_timestamp() {
        let state = mock_state().await;
        let app = crate::router(state.clone());

        let body = json!({ "hash": "abc123def456" }).to_string();
        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/revoke")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        assert!(json.get("tx_hash").is_some());
        assert!(json.get("revoked_at").is_some());
    }

    #[tokio::test]
    async fn revoke_empty_hash_returns_400() {
        let state = mock_state().await;
        let app = crate::router(state);

        let body = json!({ "hash": "" }).to_string();
        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/revoke")
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn verify_after_revoke_returns_revoked_true() {
        let state = mock_state().await;

        // First anchor the hash so it exists
        let hash = "deadbeef1234";
        stellar::write_manage_data(
            &state.stellar_client,
            &state.account_keypair,
            hash,
            Some(b"anchored".to_vec()),
        )
        .await
        .unwrap();

        // Now revoke it
        stellar::write_manage_data(
            &state.stellar_client,
            &state.account_keypair,
            &format!("revoked_{}", hash),
            Some(chrono::Utc::now().to_rfc3339().as_bytes().to_vec()),
        )
        .await
        .unwrap();

        state.cache.invalidate(hash).await;

        let app = crate::router(state);
        let req = Request::builder()
            .method("POST")
            .uri("/cmmty/verify")
            .header("content-type", "application/json")
            .body(Body::from(json!({ "hash": hash }).to_string()))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(json["verified"], false);
        assert_eq!(json["revoked"], true);
    }
}