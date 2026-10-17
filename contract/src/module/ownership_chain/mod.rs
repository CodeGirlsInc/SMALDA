//! CT-22 — OwnershipChainValidator
//!
//! Verifies the continuity of a document's transfer-ownership history stored
//! in the Redis cache.  A valid chain requires that each transfer record's
//! `from_owner` matches the previous record's `to_owner`.
//!
//! Routes wired in `routes.rs`:
//!   GET /module/chain/:document_hash  → [`chain_handler`]
//!   GET /module/owner/:document_hash  → [`current_owner_handler`]

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::collections::HashSet;

use crate::{cache::CacheBackend, AppState, TransferRecord};

// ────────────────────────────────────────────────────────────────────────────
// Public result type
// ────────────────────────────────────────────────────────────────────────────

/// The outcome of validating an ownership chain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status")]
pub enum ValidationResult {
    /// The chain is valid: every link connects properly.
    Valid,

    /// The chain has a broken link at `gap_at_index`.
    /// `expected_owner` is what the chain required; `found_owner` is what was
    /// actually present in that record's `from_owner`.
    Invalid {
        gap_at_index: usize,
        expected_owner: String,
        found_owner: String,
    },

    Cycle { at_index: usize, owner: String },

    /// No transfer records exist for this document hash.
    Empty,
}

// ────────────────────────────────────────────────────────────────────────────
// Core validation logic
// ────────────────────────────────────────────────────────────────────────────

/// Validate the ownership chain for `document_hash` using the provided cache.
///
/// The function fetches all `TransferRecord`s stored under
/// `transfer:{document_hash}` and checks that the chain is unbroken:
///
/// ```text
/// record[0].to_owner == record[1].from_owner
/// record[1].to_owner == record[2].from_owner
/// …
/// ```
///
/// Returns:
/// - [`ValidationResult::Empty`]   — no records found
/// - [`ValidationResult::Valid`]   — chain is unbroken
/// - [`ValidationResult::Invalid`] — first gap detected, with position and owners
pub async fn validate_chain(
    document_hash: &str,
    cache: &CacheBackend,
) -> Result<ValidationResult, anyhow::Error> {
    let key = format!("transfer:{}", document_hash);
    let records: Vec<TransferRecord> = match cache.get(&key).await? {
        Some(v) => v,
        None => return Ok(ValidationResult::Empty),
    };

    if records.is_empty() {
        return Ok(ValidationResult::Empty);
    }

    // A single record is always a valid (trivially unbroken) chain.
    if records.len() == 1 {
        return Ok(ValidationResult::Valid);
    }

    let mut owners = HashSet::new();
    owners.insert(records[0].from_owner.clone());
    owners.insert(records[0].to_owner.clone());

    for i in 1..records.len() {
        let expected = &records[i - 1].to_owner;
        let found = &records[i].from_owner;
        if expected != found {
            return Ok(ValidationResult::Invalid {
                gap_at_index: i,
                expected_owner: expected.clone(),
                found_owner: found.clone(),
            });
        }
        if !owners.insert(records[i].to_owner.clone()) {
            return Ok(ValidationResult::Cycle {
                at_index: i,
                owner: records[i].to_owner.clone(),
            });
        }
    }

    Ok(ValidationResult::Valid)
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────────────────────────────────

/// `GET /module/chain/:document_hash` — returns the validation result as JSON.
pub async fn chain_handler(
    State(state): State<AppState>,
    Path(document_hash): Path<String>,
) -> impl IntoResponse {
    match validate_chain(&document_hash, &state.cache).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

/// Return only the current owner of `document_hash`, without validating the
/// full chain (#1379).
///
/// The current owner is the `to_owner` of the most recent transfer record.
/// This deliberately skips the link-by-link walk that [`validate_chain`]
/// performs, so a caller that only needs "who owns this now" does not pay for
/// a full integrity check — and still gets an answer even when the historical
/// chain has a gap.
///
/// Returns `Ok(None)` when no transfer records exist for the document.
pub async fn current_owner(
    document_hash: &str,
    cache: &CacheBackend,
) -> Result<Option<String>, anyhow::Error> {
    let key = format!("transfer:{}", document_hash);
    let records: Vec<TransferRecord> = match cache.get(&key).await? {
        Some(v) => v,
        None => return Ok(None),
    };

    Ok(records.last().map(|record| record.to_owner.clone()))
}

/// `GET /module/owner/:document_hash` — returns just the current owner as JSON.
pub async fn current_owner_handler(
    State(state): State<AppState>,
    Path(document_hash): Path<String>,
) -> impl IntoResponse {
    match current_owner(&document_hash, &state.cache).await {
        Ok(Some(owner)) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "document_hash": document_hash,
                "owner": owner,
            })),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "no ownership records found for document",
                "document_hash": document_hash,
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Unit tests
// ────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::{CacheBackend, InMemoryCache};

    /// Helper: build a minimal TransferRecord for testing.
    fn make_record(from: &str, to: &str) -> TransferRecord {
        TransferRecord {
            document_hash: "test_doc".to_string(),
            from_owner: from.to_string(),
            to_owner: to.to_string(),
            transfer_date: "2025-01-01".to_string(),
            transfer_reference: "REF".to_string(),
            transfer_hash: "hash".to_string(),
            memo: "memo".to_string(),
            anchored_at: "2025-01-01T00:00:00Z".to_string(),
        }
    }

    async fn cache_with_records(records: Vec<TransferRecord>) -> CacheBackend {
        let cache = CacheBackend::InMemory(InMemoryCache::new());
        if !records.is_empty() {
            let key = format!("transfer:{}", records[0].document_hash);
            cache.set(&key, &records, 3600).await.unwrap();
        }
        cache
    }

    #[tokio::test]
    async fn empty_history_returns_empty() {
        let cache = CacheBackend::InMemory(InMemoryCache::new());
        let result = validate_chain("no_such_hash", &cache).await.unwrap();
        assert_eq!(result, ValidationResult::Empty);
    }

    #[tokio::test]
    async fn single_transfer_is_valid() {
        let records = vec![make_record("Alice", "Bob")];
        let cache = cache_with_records(records).await;
        let result = validate_chain("test_doc", &cache).await.unwrap();
        assert_eq!(result, ValidationResult::Valid);
    }

    #[tokio::test]
    async fn valid_two_step_chain() {
        // Alice → Bob → Charlie
        let records = vec![make_record("Alice", "Bob"), make_record("Bob", "Charlie")];
        let cache = cache_with_records(records).await;
        let result = validate_chain("test_doc", &cache).await.unwrap();
        assert_eq!(result, ValidationResult::Valid);
    }

    #[tokio::test]
    async fn gap_at_index_1() {
        // Alice → Bob, then Dave → Charlie (gap: expected Bob, found Dave)
        let records = vec![
            make_record("Alice", "Bob"),
            make_record("Dave", "Charlie"),
        ];
        let cache = cache_with_records(records).await;
        let result = validate_chain("test_doc", &cache).await.unwrap();
        assert_eq!(
            result,
            ValidationResult::Invalid {
                gap_at_index: 1,
                expected_owner: "Bob".to_string(),
                found_owner: "Dave".to_string(),
            }
        );
    }

    #[tokio::test]
    async fn gap_at_last_transfer() {
        // Alice → Bob → Charlie (valid), Charlie → Eve (valid), then Mallory → Frank (gap)
        let records = vec![
            make_record("Alice", "Bob"),
            make_record("Bob", "Charlie"),
            make_record("Charlie", "Eve"),
            make_record("Mallory", "Frank"),
        ];
        let cache = cache_with_records(records).await;
        let result = validate_chain("test_doc", &cache).await.unwrap();
        assert_eq!(
            result,
            ValidationResult::Invalid {
                gap_at_index: 3,
                expected_owner: "Eve".to_string(),
                found_owner: "Mallory".to_string(),
            }
        );
    }

    #[tokio::test]
    async fn circular_chain_is_detected() {
        let records = vec![make_record("Alice", "Bob"), make_record("Bob", "Alice")];
        let cache = cache_with_records(records).await;
        let result = validate_chain("test_doc", &cache).await.unwrap();
        assert_eq!(
            result,
            ValidationResult::Cycle {
                at_index: 1,
                owner: "Alice".to_string(),
            }
        );
    }

    #[tokio::test]
    async fn current_owner_returns_latest_to_owner() {
        let records = vec![make_record("Alice", "Bob"), make_record("Bob", "Charlie")];
        let cache = cache_with_records(records).await;
        let owner = current_owner("test_doc", &cache).await.unwrap();
        assert_eq!(owner.as_deref(), Some("Charlie"));
    }

    #[tokio::test]
    async fn current_owner_is_none_for_unknown_document() {
        let cache = CacheBackend::InMemory(InMemoryCache::new());
        let owner = current_owner("missing_doc", &cache).await.unwrap();
        assert_eq!(owner, None);
    }

    #[tokio::test]
    async fn current_owner_does_not_require_an_intact_chain() {
        // The latest record still answers the ownership question even when the
        // chain is broken; that is the point of the lightweight endpoint.
        let records = vec![make_record("Alice", "Bob"), make_record("Mallory", "Frank")];
        let cache = cache_with_records(records).await;
        let owner = current_owner("test_doc", &cache).await.unwrap();
        assert_eq!(owner.as_deref(), Some("Frank"));
    }
}
