use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Current event schema version.
///
/// Bump this when a field is **removed or retyped**. Adding an optional field
/// does not need a bump, because consumers that parse a fixed shape keep
/// working.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

/// Core event type for audit trail
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Event {
    /// Unique event ID
    pub id: String,
    /// Document or aggregate ID being modified
    pub aggregate_id: String,
    /// Type of event (Created, Updated, Deleted, etc.)
    pub event_type: String,
    /// Event payload as JSON
    pub data: serde_json::Value,
    /// Timestamp when event occurred
    pub timestamp: DateTime<Utc>,
    /// Sequential event number
    pub sequence: u64,
    /// User or system that triggered the event
    pub actor: String,
    /// Additional metadata
    pub metadata: Option<serde_json::Value>,
    /// Schema version of this event, as [`EVENT_SCHEMA_VERSION`].
    ///
    /// Defaults to 1 when absent so events written before this field existed
    /// still deserialize. That is the whole reason this is additive: a stored
    /// audit log is a durable record, and making a new field mandatory would
    /// make every previously written event unreadable.
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
}

fn default_schema_version() -> u32 {
    EVENT_SCHEMA_VERSION
}

impl Event {
    /// Create a new event at the current schema version.
    pub fn new(
        aggregate_id: String,
        event_type: String,
        data: serde_json::Value,
        actor: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            aggregate_id,
            event_type,
            data,
            timestamp: Utc::now(),
            sequence: 0,
            actor,
            metadata: None,
            schema_version: EVENT_SCHEMA_VERSION,
        }
    }

    /// Add metadata to event
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    /// Serialize event to JSON string
    pub fn to_json(&self) -> crate::error::Result<String> {
        serde_json::to_string(self)
            .map_err(|e| crate::error::AuditError::SerializationError(e.to_string()))
    }

    /// Deserialize event from JSON string
    ///
    /// Accepts events written before `schema_version` existed; see the field
    /// docs for why the default is load-bearing rather than a convenience.
    pub fn from_json(json: &str) -> crate::error::Result<Self> {
        serde_json::from_str(json)
            .map_err(|e| crate::error::AuditError::SerializationError(e.to_string()))
    }

    /// Whether this event was written by a newer schema than this build knows.
    ///
    /// Lets a consumer refuse to misread an unknown future shape instead of
    /// silently dropping fields it does not recognise.
    pub fn is_newer_than_current(&self) -> bool {
        self.schema_version > EVENT_SCHEMA_VERSION
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_creation() {
        let event = Event::new(
            "doc-1".to_string(),
            "Created".to_string(),
            serde_json::json!({"title": "Test"}),
            "user-1".to_string(),
        );

        assert_eq!(event.aggregate_id, "doc-1");
        assert_eq!(event.event_type, "Created");
        assert!(!event.id.is_empty());
    }

    #[test]
    fn test_event_serialization() {
        let event = Event::new(
            "doc-1".to_string(),
            "Created".to_string(),
            serde_json::json!({"title": "Test"}),
            "user-1".to_string(),
        );

        let json = event.to_json().unwrap();
        let deserialized = Event::from_json(&json).unwrap();

        assert_eq!(event.id, deserialized.id);
        assert_eq!(event.aggregate_id, deserialized.aggregate_id);
    }

    // ── Schema versioning ────────────────────────────────────────

    #[test]
    fn new_events_carry_the_current_schema_version() {
        let event = Event::new(
            "doc-1".to_string(),
            "Created".to_string(),
            serde_json::json!({}),
            "system".to_string(),
        );
        assert_eq!(event.schema_version, EVENT_SCHEMA_VERSION);
        assert!(!event.is_newer_than_current());
    }

    #[test]
    fn schema_version_is_serialized() {
        // A version that is never written is not a version. Consumers on other
        // services read this JSON, so it has to survive the round trip.
        let event = Event::new(
            "doc-1".to_string(),
            "Created".to_string(),
            serde_json::json!({}),
            "system".to_string(),
        );
        let json = event.to_json().unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["schema_version"], EVENT_SCHEMA_VERSION);
    }

    #[test]
    fn an_event_written_before_versioning_still_deserializes() {
        // The stored audit log is durable. Without a serde default, adding this
        // field would make every previously written event unreadable, which is
        // a far worse regression than the one this field prevents.
        let legacy = serde_json::json!({
            "id": "evt-1",
            "aggregate_id": "doc-1",
            "event_type": "Created",
            "data": {"title": "Test"},
            "timestamp": "2024-01-01T00:00:00Z",
            "sequence": 0,
            "actor": "user-1",
            "metadata": null,
        });

        let event = Event::from_json(&legacy.to_string()).unwrap();
        assert_eq!(event.schema_version, EVENT_SCHEMA_VERSION);
        assert_eq!(event.aggregate_id, "doc-1");
    }

    #[test]
    fn a_future_schema_is_reported_rather_than_misread() {
        let future = serde_json::json!({
            "id": "evt-1",
            "aggregate_id": "doc-1",
            "event_type": "Created",
            "data": {},
            "timestamp": "2024-01-01T00:00:00Z",
            "sequence": 0,
            "actor": "user-1",
            "metadata": null,
            "schema_version": EVENT_SCHEMA_VERSION + 1,
        });

        let event = Event::from_json(&future.to_string()).unwrap();
        assert_eq!(
            event.schema_version,
            EVENT_SCHEMA_VERSION + 1,
            "an unknown future version must round-trip, not be silently clamped"
        );
        assert!(event.is_newer_than_current());
    }

    #[test]
    fn version_round_trips_through_serialization() {
        let mut event = Event::new(
            "doc-1".to_string(),
            "Updated".to_string(),
            serde_json::json!({ "field": 1 }),
            "user-1".to_string(),
        );
        event.schema_version = EVENT_SCHEMA_VERSION + 5;

        let restored = Event::from_json(&event.to_json().unwrap()).unwrap();
        assert_eq!(restored.schema_version, event.schema_version);
        assert!(restored.is_newer_than_current());
    }
}
