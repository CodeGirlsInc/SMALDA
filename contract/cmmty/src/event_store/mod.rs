use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Discriminant for each audit event type.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    HashAnchored,
    HashRevoked,
    VerificationQueried,
}

/// An immutable audit event stored in the event log.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CmmtyEvent {
    pub kind: EventKind,
    pub hash: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<String>,
}

impl CmmtyEvent {
    pub fn new(kind: EventKind, hash: impl Into<String>) -> Self {
        Self {
            kind,
            hash: hash.into(),
            timestamp: Utc::now(),
            actor: None,
        }
    }
}

fn redis_key(hash: &str) -> String {
    format!("events:{}", hash)
}

/// Append an event to the Redis sorted set for `hash`.
/// Score = Unix timestamp in milliseconds for ordering.
pub async fn append(conn: &mut redis::aio::ConnectionManager, event: &CmmtyEvent) -> anyhow::Result<()> {
    let key = redis_key(&event.hash);
    let score = event.timestamp.timestamp_millis() as f64;
    let payload = serde_json::to_string(event)?;
    conn.zadd::<_, _, _, ()>(&key, payload, score).await?;
    Ok(())
}

/// Replay all events for `hash` in chronological order.
pub async fn replay(conn: &mut redis::aio::ConnectionManager, hash: &str) -> anyhow::Result<Vec<CmmtyEvent>> {
    let key = redis_key(hash);
    let raw: Vec<String> = conn.zrange(&key, 0, -1).await?;
    raw.iter()
        .map(|s| serde_json::from_str(s).map_err(anyhow::Error::from))
        .collect()
}

/// Reconstruct current state: returns the latest event kind for the hash, if any.
pub fn current_state(events: &[CmmtyEvent]) -> Option<&EventKind> {
    events.last().map(|e| &e.kind)
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/cmmty/events/:hash", get(get_events))
        .with_state(state)
}

/// Retrieve the raw event stream for a document hash.
#[utoipa::path(
    get,
    path = "/cmmty/events/{hash}",
    params(("hash" = String, Path, description = "Document hash")),
    responses(
        (status = 200, description = "Event stream", body = Vec<CmmtyEvent>),
        (status = 500, description = "Internal error")
    )
)]
pub async fn get_events(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<Vec<CmmtyEvent>>, StatusCode> {
    let mut conn = (*state.redis).clone();
    replay(&mut conn, &hash)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_event(kind: EventKind) -> CmmtyEvent {
        CmmtyEvent::new(kind, "abc123")
    }

    #[test]
    fn test_current_state_empty() {
        assert!(current_state(&[]).is_none());
    }

    #[test]
    fn test_current_state_last_wins() {
        let events = vec![
            make_event(EventKind::HashAnchored),
            make_event(EventKind::HashRevoked),
        ];
        assert_eq!(current_state(&events), Some(&EventKind::HashRevoked));
    }

    #[test]
    fn test_event_serialization_roundtrip() {
        let e = make_event(EventKind::VerificationQueried);
        let json = serde_json::to_string(&e).unwrap();
        let back: CmmtyEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back.kind, EventKind::VerificationQueried);
        assert_eq!(back.hash, "abc123");
    }

    #[test]
    fn test_redis_key_format() {
        assert_eq!(redis_key("deadbeef"), "events:deadbeef");
    }
}
