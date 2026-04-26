use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}

impl Event {
    /// Create a new event
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
    pub fn from_json(json: &str) -> crate::error::Result<Self> {
        serde_json::from_str(json)
            .map_err(|e| crate::error::AuditError::SerializationError(e.to_string()))
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
}
