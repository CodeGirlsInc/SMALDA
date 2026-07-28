use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use crate::types::ValidationErrorResponse;

#[derive(Debug)]
pub enum AppError {
    Validation(String),
    NotFound(String),
    Internal(String),
    BadGateway(String),
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
        }
    }
}
