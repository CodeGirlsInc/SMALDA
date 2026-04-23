//! Rate-limit configuration loaded from environment variables.

use std::env;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClientTier {
    Known,
    Default,
}

/// Configuration for per-client rate limiting.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Max requests per window for unknown/anonymous clients.
    pub default_limit: u64,
    /// Max requests per window for known (whitelisted) clients.
    pub known_client_limit: u64,
    /// Window size in seconds.
    pub window_secs: u64,
    /// List of known client IDs (from `KNOWN_CLIENT_IDS` env var, comma-separated).
    pub known_clients: Vec<String>,
}

impl RateLimitConfig {
    /// Load from environment variables with sensible defaults.
    ///
    /// | Variable              | Default |
    /// |-----------------------|---------|
    /// | `RL_DEFAULT_LIMIT`    | 60      |
    /// | `RL_KNOWN_LIMIT`      | 600     |
    /// | `RL_WINDOW_SECS`      | 60      |
    /// | `KNOWN_CLIENT_IDS`    | (empty) |
    pub fn from_env() -> Self {
        let default_limit = env_u64("RL_DEFAULT_LIMIT", 60);
        let known_client_limit = env_u64("RL_KNOWN_LIMIT", 600);
        let window_secs = env_u64("RL_WINDOW_SECS", 60);
        let known_clients = env::var("KNOWN_CLIENT_IDS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
            .collect();

        Self {
            default_limit,
            known_client_limit,
            window_secs,
            known_clients,
        }
    }

    /// Determine the tier for a given client ID.
    pub fn tier_for(&self, client_id: &str) -> ClientTier {
        if self.known_clients.iter().any(|k| k == client_id) {
            ClientTier::Known
        } else {
            ClientTier::Default
        }
    }
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tier_for_known_client() {
        let cfg = RateLimitConfig {
            default_limit: 10,
            known_client_limit: 100,
            window_secs: 60,
            known_clients: vec!["client-a".to_string()],
        };
        assert_eq!(cfg.tier_for("client-a"), ClientTier::Known);
        assert_eq!(cfg.tier_for("client-b"), ClientTier::Default);
    }

    #[test]
    fn tier_for_empty_known_list() {
        let cfg = RateLimitConfig {
            default_limit: 10,
            known_client_limit: 100,
            window_secs: 60,
            known_clients: vec![],
        };
        assert_eq!(cfg.tier_for("anyone"), ClientTier::Default);
    }
}
