use std::env;

use thiserror::Error;
use url::Url;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub port: u16,
    pub stellar_horizon_url: String,
    pub stellar_secret_key: Option<String>,
    pub redis_url: String,
    pub rate_limit_per_second: u32,
    pub rate_limit_burst: u32,
    pub stellar_max_retries: u32,
    pub log_level: String,
    pub webhook_urls: Vec<String>,
    pub webhook_secret: Option<String>,
    pub cache_verification_ttl: u64,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("configuration validation failed:\n{0}")]
    Validation(String),
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let mut errors = Vec::new();

        // Helper to read env var with default
        fn get_env_or_default(key: &str, default: &str) -> String {
            env::var(key).unwrap_or_else(|_| default.to_string())
        }

        // Basic string values with defaults
        let port_raw = get_env_or_default("PORT", "8080");
        let stellar_horizon_url =
            get_env_or_default("STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org");
        let redis_url = get_env_or_default("REDIS_URL", "redis://127.0.0.1:6379");
        let log_level = get_env_or_default("LOG_LEVEL", "info");
        let webhook_urls_raw = get_env_or_default("WEBHOOK_URLS", "");

        let stellar_secret_key = match env::var("STELLAR_SECRET_KEY") {
            Ok(key) => {
                // Validate the secret key format (should be 56 chars starting with 'S')
                if key.len() != 56 || !key.starts_with('S') {
                    errors.push(
                        "STELLAR_SECRET_KEY must be a 56-character string starting with 'S'"
                            .to_string(),
                    );
                }
                Some(key)
            }
            Err(_) => {
                errors.push(
                    "STELLAR_SECRET_KEY is required but not set. Please set the environment variable."
                        .to_string(),
                );
                None
            }
        };
        let webhook_secret = env::var("WEBHOOK_SECRET").ok();

        // Numeric values with defaults
        let rate_limit_per_second_raw = get_env_or_default("RATE_LIMIT_PER_SECOND", "10");
        let rate_limit_burst_raw =
            get_env_or_default("RATE_LIMIT_BURST", &rate_limit_per_second_raw);
        let stellar_max_retries_raw = get_env_or_default("STELLAR_MAX_RETRIES", "3");
        let cache_verification_ttl_raw = get_env_or_default("CACHE_VERIFICATION_TTL", "3600");

        // Parse and validate port
        let port: u16 = match port_raw.parse() {
            Ok(p) if p > 0 => p,
            Ok(_) => {
                errors.push("PORT must be between 1 and 65535".to_string());
                8080
            }
            Err(_) => {
                errors.push(format!("PORT must be a valid u16, got '{}'", port_raw));
                8080
            }
        };

        // Validate horizon URL
        if Url::parse(&stellar_horizon_url).is_err() {
            errors.push(format!(
                "STELLAR_HORIZON_URL must be a valid URL, got '{}'",
                stellar_horizon_url
            ));
        }

        // Parse numeric values
        let rate_limit_per_second: u32 = match rate_limit_per_second_raw.parse() {
            Ok(v) if v > 0 => v,
            Ok(_) => {
                errors.push("RATE_LIMIT_PER_SECOND must be greater than 0".to_string());
                10
            }
            Err(_) => {
                errors.push(format!(
                    "RATE_LIMIT_PER_SECOND must be a valid u32, got '{}'",
                    rate_limit_per_second_raw
                ));
                10
            }
        };

        let rate_limit_burst: u32 = match rate_limit_burst_raw.parse() {
            Ok(v) => v,
            Err(_) => {
                errors.push(format!(
                    "RATE_LIMIT_BURST must be a valid u32, got '{}'",
                    rate_limit_burst_raw
                ));
                rate_limit_per_second
            }
        };

        let stellar_max_retries: u32 = match stellar_max_retries_raw.parse() {
            Ok(v) => v,
            Err(_) => {
                errors.push(format!(
                    "STELLAR_MAX_RETRIES must be a valid u32, got '{}'",
                    stellar_max_retries_raw
                ));
                3
            }
        };

        let cache_verification_ttl: u64 = match cache_verification_ttl_raw.parse() {
            Ok(v) => v,
            Err(_) => {
                errors.push(format!(
                    "CACHE_VERIFICATION_TTL must be a valid u64, got '{}'",
                    cache_verification_ttl_raw
                ));
                3600
            }
        };

        // Parse webhook URLs (comma-separated, ignore empty)
        let webhook_urls: Vec<String> = webhook_urls_raw
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
            .collect();

        if !errors.is_empty() {
            let joined = errors.join("\n- ");
            return Err(ConfigError::Validation(format!("- {}", joined)));
        }

        Ok(Self {
            port,
            stellar_horizon_url,
            stellar_secret_key,
            redis_url,
            rate_limit_per_second,
            rate_limit_burst,
            stellar_max_retries,
            log_level,
            webhook_urls,
            webhook_secret,
            cache_verification_ttl,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clear_env() {
        let keys = [
            "PORT",
            "STELLAR_HORIZON_URL",
            "STELLAR_SECRET_KEY",
            "REDIS_URL",
            "RATE_LIMIT_PER_SECOND",
            "RATE_LIMIT_BURST",
            "STELLAR_MAX_RETRIES",
            "LOG_LEVEL",
            "WEBHOOK_URLS",
            "WEBHOOK_SECRET",
            "CACHE_VERIFICATION_TTL",
        ];
        for key in keys {
            env::remove_var(key);
        }
    }

    #[test]
    fn from_env_uses_defaults_when_missing() {
        clear_env();
        let cfg = AppConfig::from_env().expect("config should load with defaults");

        assert_eq!(cfg.port, 8080);
        assert_eq!(
            cfg.stellar_horizon_url,
            "https://horizon-testnet.stellar.org"
        );
        assert_eq!(cfg.redis_url, "redis://127.0.0.1:6379");
        assert_eq!(cfg.rate_limit_per_second, 10);
        assert_eq!(cfg.cache_verification_ttl, 3600);
    }

    #[test]
    fn from_env_invalid_values_report_errors() {
        clear_env();
        env::set_var("PORT", "0");
        env::set_var("STELLAR_HORIZON_URL", "not-a-url");
        env::set_var("RATE_LIMIT_PER_SECOND", "0");

        let err = AppConfig::from_env().expect_err("config should fail");
        let msg = err.to_string();

        assert!(msg.contains("PORT must be between 1 and 65535"));
        assert!(msg.contains("STELLAR_HORIZON_URL must be a valid URL"));
        assert!(msg.contains("RATE_LIMIT_PER_SECOND must be greater than 0"));
    }

    #[test]
    fn from_env_parses_valid_config() {
        clear_env();
        env::set_var("PORT", "9090");
        env::set_var("STELLAR_HORIZON_URL", "https://example.com");
        env::set_var("REDIS_URL", "redis://redis:6379");
        env::set_var("RATE_LIMIT_PER_SECOND", "100");
        env::set_var("WEBHOOK_URLS", "https://a.com, https://b.com");

        let cfg = AppConfig::from_env().expect("config should load");

        assert_eq!(cfg.port, 9090);
        assert_eq!(cfg.stellar_horizon_url, "https://example.com");
        assert_eq!(cfg.redis_url, "redis://redis:6379");
        assert_eq!(cfg.rate_limit_per_second, 100);
        assert_eq!(cfg.webhook_urls.len(), 2);
    }
}
