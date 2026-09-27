//! HTTP route composition for the verifier service.
//!
//! This module maps URL paths and HTTP methods to handlers. Handler behavior,
//! shared state, and service-level metrics are defined in `lib.rs` and
//! `metrics.rs`; `site.rs` is an unused legacy metrics registry.
//! `/v1` is the canonical API prefix; unprefixed routes remain compatibility
//! aliases for existing clients.

use axum::{
    routing::{get, post},
    Router,
};
use tower::ServiceBuilder;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;

use crate::{
    audit_log_handler, batch_verify_documents, enforce_rate_limit, health_check, metrics_handler,
    record_transfer, revoke_document, submit_document, verify_document, verify_document_by_hash,
    verify_document_history, AppState, REQUEST_ID_HEADER,
};
use crate::handlers::transfer::get_transfer_history;

pub fn app(state: AppState) -> Router {
    let request_id_header = axum::http::HeaderName::from_static(REQUEST_ID_HEADER);
    let span_header = request_id_header.clone();

    Router::new()
        .nest(
            "/v1",
            Router::new()
                .route("/health", get(health_check))
                .route("/metrics", get(metrics_handler))
                .route("/audit", get(audit_log_handler))
                .route("/verify", post(verify_document))
                .route("/verify/batch", post(batch_verify_documents))
                .route("/verify/:hash", get(verify_document_by_hash))
                .route("/verify/:hash/history", get(verify_document_history))
                .route("/submit", post(submit_document))
                .route("/revoke", post(revoke_document))
                .route("/transfer", post(record_transfer))
                .route("/transfer/:document_hash", get(get_transfer_history)),
        )
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_handler))
        .route("/audit", get(audit_log_handler))
        .route("/verify", post(verify_document))
        .route("/verify/batch", post(batch_verify_documents))
        .route("/verify/:hash", get(verify_document_by_hash))
        .route("/verify/:hash/history", get(verify_document_history))
        .route("/submit", post(submit_document))
        .route("/revoke", post(revoke_document))
        .route("/transfer", post(record_transfer))
        .route("/transfer/:document_hash", get(get_transfer_history))
        .layer(
            ServiceBuilder::new()
                // Honor an inbound X-Request-Id; generate one only when absent.
                .layer(SetRequestIdLayer::new(
                    request_id_header.clone(),
                    MakeRequestUuid,
                ))
                .layer(
                    TraceLayer::new_for_http().make_span_with(
                        move |request: &axum::http::Request<_>| {
                            let request_id = request
                                .headers()
                                .get(&span_header)
                                .and_then(|value| value.to_str().ok())
                                .unwrap_or("unknown");

                            tracing::info_span!(
                                "http_request",
                                method = %request.method(),
                                path = %request.uri().path(),
                                request_id = %request_id,
                            )
                        },
                    ),
                )
                .layer(PropagateRequestIdLayer::new(request_id_header)),
        )
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            enforce_rate_limit,
        ))
        .with_state(state)
}
