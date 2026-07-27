use std::sync::Arc;
use std::time::Duration;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, RedisCache};
use stellar_doc_verifier::config::AppConfig;
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::*;
use tokio::net::TcpListener;
use tokio::sync::Notify;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load configuration
    let config = AppConfig::from_env()?;

    // Initialize tracing
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new(format!(
            "stellar_doc_verifier={},tower_http={}",
            config.log_level, config.log_level
        ))
    });
    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    info!("Starting Stellar Document Verification Service");

    // Startup configuration summary (redacting secrets)
    info!(
        "Configuration: port={}, stellar_horizon_url={}, redis_url={}, rate_limit_per_second={}, rate_limit_burst={}, stellar_max_retries={}, log_level={}, webhook_urls={:?}, stellar_secret_key=[REDACTED], webhook_secret=[REDACTED], cache_verification_ttl={}, shutdown_timeout_secs={}",
        config.port,
        config.stellar_horizon_url,
        config.redis_url,
        config.rate_limit_per_second,
        config.rate_limit_burst,
        config.stellar_max_retries,
        config.log_level,
        config.webhook_urls,
        config.cache_verification_ttl,
        config.shutdown_timeout_secs,
    );

    // Initialize components
    let stellar_url = config.stellar_horizon_url.clone();
    let redis_url = config.redis_url.clone();
    let stellar = Arc::new(StellarClient::new(&stellar_url));
    let cache = Arc::new(CacheBackend::Redis(RedisCache::new(&redis_url).await?));
    let metrics = Arc::new(MetricsRegistry::new());

    let state = AppState {
        stellar,
        cache: cache.clone(),
        metrics,
        stellar_secret_key: config.stellar_secret_key.clone().unwrap_or_default(),
    };
    let app = app(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    info!("Listening on {}", addr);
    let listener = TcpListener::bind(&addr).await?;

    let shutdown_timeout = Duration::from_secs(config.shutdown_timeout_secs);
    let notify = Arc::new(Notify::new());

    let server = axum::serve(listener, app).with_graceful_shutdown(shutdown_signal(notify.clone()));

    tokio::select! {
        result = server => {
            match result {
                Ok(()) => info!("All connections drained; shutdown complete"),
                Err(e) => warn!("Server error during shutdown: {}", e),
            }
        }
        _ = async {
            notify.notified().await;
            info!(
                "Shutdown signal received; draining in-flight requests (timeout: {}s)",
                config.shutdown_timeout_secs
            );
            tokio::time::sleep(shutdown_timeout).await;
        } => {
            warn!(
                "Graceful shutdown timeout of {}s exceeded; forcing remaining connections closed",
                config.shutdown_timeout_secs
            );
        }
    }

    info!("Closing cache connection");
    cache.close().await;

    Ok(())
}

/// Waits for SIGINT (Ctrl+C) or SIGTERM, then notifies the shutdown timeout
/// watcher. Only once this future resolves does the shutdown timeout clock
/// start -- normal operation is never time-boxed, only the drain window.
async fn shutdown_signal(notify: Arc<Notify>) {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received SIGINT, starting graceful shutdown");
        },
        _ = terminate => {
            info!("Received SIGTERM, starting graceful shutdown");
        },
    }

    notify.notify_one();
}
