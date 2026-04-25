use serde::{Deserialize, Serialize};

/// The kind of event recorded for a document hash.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventType {
    Anchored,
    Revoked,
}

/// A single event in a document hash's lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEvent {
    /// Whether this was an anchor or revocation event.
    pub event_type: EventType,

    /// The Stellar transaction ID that recorded this event.
    pub tx_id: String,

    /// The Stellar ledger sequence number in which this event was finalized.
    pub ledger: u32,

    /// ISO-8601 / RFC-3339 close time of the ledger that contains the event.
    pub timestamp: String,
}

/// Response body for `GET /cmmty/history/:hash`.
#[derive(Debug, Serialize)]
pub struct HistoryResponse {
    /// The queried document hash.
    pub hash: String,

    /// All events, ordered chronologically (oldest first).
    pub events: Vec<HistoryEvent>,
}