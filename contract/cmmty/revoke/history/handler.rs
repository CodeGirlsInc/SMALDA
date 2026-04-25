use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::history::types::{EventType, HistoryEvent, HistoryResponse};
use crate::shared::{AppError, AppState, stellar};

/// GET /cmmty/history/:hash
///
/// Returns all verification events (ANCHORED, REVOKED) for a given document
/// hash, ordered chronologically (oldest first).
///
/// This is implemented by scanning Stellar account data for:
///   - A key equal to `<hash>`          → ANCHORED event
///   - A key equal to `revoked_<hash>`  → REVOKED  event
///
/// Each `manageData` entry stores the transaction hash and ledger close time
/// that was written at anchor/revoke time, so we surface those directly.
pub async fn history_handler(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<HistoryResponse>, AppError> {
    let hash = hash.trim().to_string();

    if hash.is_empty() {
        return Err(AppError::BadRequest("hash path param must not be empty".into()));
    }

    // Fetch all manageData entries for the service account from Stellar
    let account_data = stellar::fetch_account_data(&state.stellar_client, &state.account_keypair)
        .await
        .map_err(|e| {
            state.metrics.stellar_errors_total.inc();
            AppError::StellarError(e.to_string())
        })?;

    let mut events: Vec<HistoryEvent> = Vec::new();

    // ANCHORED event ─ key == hash
    if let Some(record) = account_data.get(&hash) {
        events.push(HistoryEvent {
            event_type: EventType::Anchored,
            tx_id: record.tx_id.clone(),
            ledger: record.ledger,
            timestamp: record.timestamp.clone(),
        });
    }

    // REVOKED event ─ key == "revoked_<hash>"
    let revoke_key = format!("revoked_{}", hash);
    if let Some(record) = account_data.get(&revoke_key) {
        events.push(HistoryEvent {
            event_type: EventType::Revoked,
            tx_id: record.tx_id.clone(),
            ledger: record.ledger,
            timestamp: record.timestamp.clone(),
        });
    }

    // Sort chronologically (oldest ledger first)
    events.sort_by_key(|e| e.ledger);

    Ok(Json(HistoryResponse { hash, events }))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_helpers::mock_state;
    use axum::{body::Body, http::Request};
    use serde_json::Value;
    use tower::ServiceExt;

    #[tokio::test]
    async fn history_returns_empty_for_unknown_hash() {
        let state = mock_state().await;
        let app = crate::router(state);

        let req = Request::builder()
            .method("GET")
            .uri("/cmmty/history/unknownhash999")
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(json["events"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn history_returns_anchored_event() {
        let state = mock_state().await;
        let hash = "anchoredhash01";

        // Seed the mock Stellar store with an ANCHORED record
        state
            .stellar_client
            .seed_manage_data(hash, "txAnchor001", 100, "2024-01-01T00:00:00Z")
            .await;

        let app = crate::router(state);
        let req = Request::builder()
            .method("GET")
            .uri(format!("/cmmty/history/{}", hash))
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        let events = json["events"].as_array().unwrap();

        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["eventType"], "ANCHORED");
        assert_eq!(events[0]["txId"], "txAnchor001");
    }

    #[tokio::test]
    async fn history_returns_anchored_then_revoked_in_order() {
        let state = mock_state().await;
        let hash = "fulllifecyclehash";

        state
            .stellar_client
            .seed_manage_data(hash, "txAnchor002", 200, "2024-02-01T00:00:00Z")
            .await;
        state
            .stellar_client
            .seed_manage_data(
                &format!("revoked_{}", hash),
                "txRevoke002",
                350,
                "2024-03-01T00:00:00Z",
            )
            .await;

        let app = crate::router(state);
        let req = Request::builder()
            .method("GET")
            .uri(format!("/cmmty/history/{}", hash))
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        let events = json["events"].as_array().unwrap();

        assert_eq!(events.len(), 2);
        // Oldest first
        assert_eq!(events[0]["eventType"], "ANCHORED");
        assert_eq!(events[0]["ledger"], 200);
        assert_eq!(events[1]["eventType"], "REVOKED");
        assert_eq!(events[1]["ledger"], 350);
    }
}