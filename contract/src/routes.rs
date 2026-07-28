use axum::{
    routing::{get, post},
    Router,
};
use tower_http::trace::TraceLayer;

use crate::handlers::{health, revoke, submit, transfer, verify};
use crate::types::AppState;

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health_check))
        .route("/metrics", get(health::metrics_handler))
        .route("/verify", post(verify::verify_document))
        .route("/verify/batch", post(verify::batch_verify_documents))
        .route("/verify/:hash", get(verify::verify_document_by_hash))
        .route(
            "/verify/:hash/history",
            get(verify::verify_document_history),
        )
        .route("/submit", post(submit::submit_document))
        .route("/revoke", post(revoke::revoke_document))
        .route("/transfer", post(transfer::record_transfer))
        .route(
            "/transfer/:document_hash",
            get(transfer::get_transfer_history),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
