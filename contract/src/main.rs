use std::sync::Arc;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, RedisCache};
use stellar_doc_verifier::config::AppConfig;
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::*;
use tokio::net::TcpListener;
use tracing::info;
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
        "Configuration: port={}, stellar_horizon_url={}, redis_url={}, rate_limit_per_second={}, rate_limit_burst={}, stellar_max_retries={}, log_level={}, webhook_urls={:?}, stellar_secret_key=[REDACTED], webhook_secret=[REDACTED], cache_verification_ttl={}",
        config.port,
        config.stellar_horizon_url,
        config.redis_url,
        config.rate_limit_per_second,
        config.rate_limit_burst,
        config.stellar_max_retries,
        config.log_level,
        config.webhook_urls,
        config.cache_verification_ttl,
    );

    // Initialize components
    let stellar_url = config.stellar_horizon_url.clone();
    let redis_url = config.redis_url.clone();

    let stellar = Arc::new(StellarClient::new(&stellar_url));
    let cache = Arc::new(CacheBackend::Redis(RedisCache::new(&redis_url).await?));
    let metrics = Arc::new(MetricsRegistry::new());

    let state = AppState {
        stellar,
        cache,
        metrics,
        stellar_secret_key: config.stellar_secret_key.clone().unwrap_or_default(),
    };

    let app = app(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    info!("Listening on {}", addr);
    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
