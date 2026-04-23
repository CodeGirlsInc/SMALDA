pub mod event_store;
pub mod graceful_shutdown;
pub mod openapi;

use axum::{routing::get, Router};
use redis::aio::ConnectionManager;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub redis: Arc<ConnectionManager>,
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .merge(openapi::router())
        .merge(event_store::router(state.clone()))
}

async fn health() -> &'static str {
    "ok"
}
