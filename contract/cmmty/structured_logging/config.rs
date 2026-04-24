//! Logging configuration loaded from environment variables.

use std::env;

/// Configuration for the structured JSON logger.
#[derive(Debug, Clone)]
pub struct LogConfig {
    /// Tracing filter directive, e.g. `"info"` or `"stellar_doc_verifier=debug"`.
    pub log_level: String,
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
        }
    }
}
