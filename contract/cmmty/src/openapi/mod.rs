use axum::{response::Html, routing::get, Json, Router};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "SMALDA Community Contract Service",
        version = "0.1.0",
        description = "Verification audit trail and event sourcing API"
    ),
    paths(
        crate::openapi::health,
        crate::event_store::get_events,
    ),
    components(schemas(
        crate::event_store::CmmtyEvent,
        crate::event_store::EventKind,
    ))
)]
pub struct ApiDoc;

pub fn router() -> Router {
    Router::new()
        .merge(
            SwaggerUi::new("/cmmty/docs")
                .url("/cmmty/openapi.json", ApiDoc::openapi()),
        )
        .route("/health", get(health))
}

/// Health check
#[utoipa::path(
    get,
    path = "/health",
    responses((status = 200, description = "Service is healthy", body = str))
)]
pub async fn health() -> &'static str {
    "ok"
}
