use axum::{
    http::{
        header::{HeaderValue, RETRY_AFTER},
        HeaderMap, StatusCode,
    },
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

use crate::types::ValidationErrorResponse;

/// Structured 503 response payload returned when upstream Horizon is
/// unreachable after the retry budget is exhausted or the circuit breaker
/// is open. Stable JSON contract: `{ status: "indeterminate", message, attempt_count }`.
#[derive(Debug, Serialize)]
pub struct IndeterminateResponse {
    /// Always literal string "indeterminate" -- kept stable for client parsing.
    pub status: &'static str,
    /// Human-readable message suitable for surfacing to operators / logs.
    pub message: String,
    /// How many retry attempts we made before giving up.
    pub attempt_count: u32,
}

#[derive(Debug)]
pub enum AppError {
    Validation(String),
    NotFound(String),
    Internal(String),
    BadGateway(String),
    /// Verification could not be completed because Horizon was unreachable
    /// after exhausting the configured retry budget, or because the circuit
    /// breaker is currently open. Maps to HTTP 503 with a `Retry-After`
    /// header so the caller can back off cleanly.
    Indeterminate {
        message: String,
        attempt_count: u32,
    },
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::Validation(msg) => (
                StatusCode::BAD_REQUEST,
                Json(ValidationErrorResponse { error: msg }),
            )
                .into_response(),
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                Json(ValidationErrorResponse { error: msg }),
            )
                .into_response(),
            AppError::Internal(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ValidationErrorResponse { error: msg }),
            )
                .into_response(),
            AppError::BadGateway(msg) => (
                StatusCode::BAD_GATEWAY,
                Json(ValidationErrorResponse { error: msg }),
            )
                .into_response(),
            AppError::Indeterminate {
                message,
                attempt_count,
            } => {
                let body = IndeterminateResponse {
                    status: "indeterminate",
                    message,
                    attempt_count,
                };
                let mut headers = HeaderMap::new();
                headers.insert(RETRY_AFTER, HeaderValue::from_static("30"));
                (StatusCode::SERVICE_UNAVAILABLE, headers, Json(body)).into_response()
            }
        }
    }
}
