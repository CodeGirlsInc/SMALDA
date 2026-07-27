//! Sanitized HTTP error responses for the stellar-doc-verifier service.
//!
//! Rule: **never** let an `anyhow` error chain, internal path, or upstream
//! Horizon body reach an HTTP client.  All errors that cross the HTTP boundary
//! go through [`ApiError`], which carries only a stable `code` string and a
//! safe human-readable `message`.  Full detail is logged server-side, keyed by
//! the request-scoped `request_id`.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Public error-code constants
// ---------------------------------------------------------------------------

pub const ERR_HASH_EMPTY: &str = "HASH_EMPTY";
pub const ERR_HASH_WRONG_LENGTH: &str = "HASH_WRONG_LENGTH";
pub const ERR_HASH_INVALID_CHAR: &str = "HASH_INVALID_CHARACTER";
pub const ERR_NOT_FOUND: &str = "NOT_FOUND";
pub const ERR_BAD_REQUEST: &str = "BAD_REQUEST";
pub const ERR_UPSTREAM: &str = "UPSTREAM_ERROR";
pub const ERR_INTERNAL: &str = "INTERNAL_ERROR";
pub const ERR_BATCH_EMPTY: &str = "BATCH_EMPTY";
pub const ERR_BATCH_TOO_LARGE: &str = "BATCH_TOO_LARGE";

// ---------------------------------------------------------------------------
// Alias kept for event.rs compatibility
// ---------------------------------------------------------------------------

pub type Result<T> = std::result::Result<T, AuditError>;

#[derive(Debug, thiserror::Error)]
pub enum AuditError {
    #[error("serialization error: {0}")]
    SerializationError(String),
}

// ---------------------------------------------------------------------------
// Wire-format error body
// ---------------------------------------------------------------------------

/// The JSON body sent to the client on every error response.
///
/// Fields are intentionally minimal — no internal paths, no stack traces,
/// no upstream response bodies.
#[derive(Debug, Serialize)]
pub struct ErrorBody {
    /// Stable machine-readable code (use the `ERR_*` constants above).
    pub code: &'static str,
    /// Safe human-readable description.
    pub message: String,
    /// Opaque identifier that correlates this response to server-side logs.
    pub request_id: String,
}

impl ErrorBody {
    pub fn new(code: &'static str, message: impl Into<String>, request_id: &str) -> Self {
        Self {
            code,
            message: message.into(),
            request_id: request_id.to_owned(),
        }
    }
}

// ---------------------------------------------------------------------------
// ApiError — typed error that converts cleanly to a Response
// ---------------------------------------------------------------------------

/// A typed HTTP error that **never leaks internals**.
///
/// Construct via [`ApiError::bad_request`], [`ApiError::upstream`], etc.
/// The `cause` field is logged but never serialized into the response body.
pub struct ApiError {
    pub status: StatusCode,
    pub body: ErrorBody,
}

impl ApiError {
    pub fn bad_request(
        code: &'static str,
        message: impl Into<String>,
        request_id: &str,
    ) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            body: ErrorBody::new(code, message, request_id),
        }
    }

    pub fn not_found(message: impl Into<String>, request_id: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            body: ErrorBody::new(ERR_NOT_FOUND, message, request_id),
        }
    }

    pub fn upstream(request_id: &str) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            body: ErrorBody::new(
                ERR_UPSTREAM,
                "An upstream dependency returned an unexpected response.",
                request_id,
            ),
        }
    }

    pub fn internal(request_id: &str) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: ErrorBody::new(
                ERR_INTERNAL,
                "An internal error occurred. Please try again later.",
                request_id,
            ),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

// ---------------------------------------------------------------------------
// Request-ID extractor helper
// ---------------------------------------------------------------------------

/// Generate a new request ID (UUIDv4).
pub fn new_request_id() -> String {
    Uuid::new_v4().to_string()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_body_contains_no_internal_detail() {
        let rid = new_request_id();
        let body = ErrorBody::new(ERR_INTERNAL, "An internal error occurred.", &rid);
        let json = serde_json::to_string(&body).unwrap();

        // Must not contain any typical Rust internal artefacts
        assert!(!json.contains("src/"));
        assert!(!json.contains("unwrap"));
        assert!(!json.contains("anyhow"));
        assert!(!json.contains("reqwest"));
        assert!(!json.contains("redis"));
        assert!(json.contains(ERR_INTERNAL));
        assert!(json.contains(&rid));
    }

    #[test]
    fn upstream_error_body_does_not_mention_horizon() {
        let rid = new_request_id();
        let err = ApiError::upstream(&rid);
        let json = serde_json::to_string(&err.body).unwrap();

        assert!(!json.to_lowercase().contains("horizon"));
        assert_eq!(err.status, StatusCode::BAD_GATEWAY);
    }

    #[test]
    fn bad_request_carries_stable_code() {
        let rid = new_request_id();
        let err = ApiError::bad_request(ERR_HASH_EMPTY, "hash must not be empty", &rid);
        assert_eq!(err.body.code, ERR_HASH_EMPTY);
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn request_id_is_valid_uuid() {
        let rid = new_request_id();
        assert!(uuid::Uuid::parse_str(&rid).is_ok());
    }
}
