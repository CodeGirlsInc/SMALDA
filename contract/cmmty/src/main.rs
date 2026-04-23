use cmmty::{app, graceful_shutdown, AppState};
use redis::aio::ConnectionManager;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    let client = redis::Client::open(redis_url)?;
    let conn = ConnectionManager::new(client).await?;

    let state = AppState {
        redis: Arc::new(conn),
    };

    let router = app(state);
    let port = std::env::var("PORT").unwrap_or_else(|_| "3002".into());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await?;
    info!("Listening on {}", addr);

    axum::serve(listener, router)
        .with_graceful_shutdown(graceful_shutdown::shutdown_signal())
        .await?;

    Ok(())
}
