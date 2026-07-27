//! CT-11 — StellarNetworkSwitcher
//!
//! Exposes the currently configured Stellar network (testnet / mainnet)
//! and validates the STELLAR_NETWORK environment variable at startup.
//!
//! Routes wired in `lib.rs`:
//!   GET /module/network  → [`network_handler`]

use std::env;

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

/// The two supported Stellar networks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StellarNetwork {
    Testnet,
    Mainnet,
}

impl StellarNetwork {
    /// Human-readable network name returned in API responses.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Testnet => "testnet",
            Self::Mainnet => "mainnet",
        }
    }

    /// Horizon base URL for this network.
    pub fn horizon_url(&self) -> &'static str {
        match self {
            Self::Testnet => "https://horizon-testnet.stellar.org",
            Self::Mainnet => "https://horizon.stellar.org",
        }
    }
}

/// Parse a network string (case-insensitive) into a [`StellarNetwork`] variant.
///
/// Returns `Ok` for `"testnet"` and `"mainnet"`, and `Err` with a descriptive
/// message for any other value.
///
/// # Examples
/// ```
/// use stellar_doc_verifier::module::network::{parse_network, StellarNetwork};
///
/// assert_eq!(parse_network("testnet").unwrap(), StellarNetwork::Testnet);
/// assert_eq!(parse_network("MAINNET").unwrap(), StellarNetwork::Mainnet);
/// assert!(parse_network("devnet").is_err());
/// ```
pub fn parse_network(value: &str) -> Result<StellarNetwork, String> {
    match value.to_lowercase().as_str() {
        "testnet" => Ok(StellarNetwork::Testnet),
        "mainnet" => Ok(StellarNetwork::Mainnet),
        other => Err(format!(
            "unrecognised STELLAR_NETWORK value '{}': expected 'testnet' or 'mainnet'",
            other
        )),
    }
}

/// Read and validate `STELLAR_NETWORK` from the environment.
///
/// Returns the parsed variant on success.  Returns an `Err` with a clear
/// message if the variable is missing or set to an unrecognised value — the
/// caller (main.rs) should treat this as a fatal startup error.
pub fn network_from_env() -> Result<StellarNetwork, String> {
    let raw = env::var("STELLAR_NETWORK").unwrap_or_else(|_| "testnet".to_string());
    parse_network(&raw).map_err(|e| {
        format!(
            "Application startup error: {}. \
             Set STELLAR_NETWORK to 'testnet' or 'mainnet' and restart.",
            e
        )
    })
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────────────────────────────────

/// Response body for `GET /module/network`.
#[derive(Debug, Serialize)]
pub struct NetworkResponse {
    pub network: &'static str,
    pub horizon_url: &'static str,
}

/// `GET /module/network` — returns the currently configured network and its
/// Horizon URL.
///
/// The STELLAR_NETWORK env var was already validated at startup, so this
/// handler simply re-reads it (defaulting to testnet) and returns 200.
pub async fn network_handler() -> impl IntoResponse {
    match network_from_env() {
        Ok(net) => (
            StatusCode::OK,
            Json(NetworkResponse {
                network: net.as_str(),
                horizon_url: net.horizon_url(),
            }),
        )
            .into_response(),
        Err(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": msg })),
        )
            .into_response(),
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Unit tests
// ────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_testnet_lowercase() {
        assert_eq!(parse_network("testnet").unwrap(), StellarNetwork::Testnet);
    }

    #[test]
    fn parse_mainnet_lowercase() {
        assert_eq!(parse_network("mainnet").unwrap(), StellarNetwork::Mainnet);
    }

    #[test]
    fn parse_mixed_case_testnet() {
        assert_eq!(parse_network("Testnet").unwrap(), StellarNetwork::Testnet);
        assert_eq!(parse_network("TESTNET").unwrap(), StellarNetwork::Testnet);
        assert_eq!(parse_network("TestNet").unwrap(), StellarNetwork::Testnet);
    }

    #[test]
    fn parse_mixed_case_mainnet() {
        assert_eq!(parse_network("Mainnet").unwrap(), StellarNetwork::Mainnet);
        assert_eq!(parse_network("MAINNET").unwrap(), StellarNetwork::Mainnet);
    }

    #[test]
    fn parse_invalid_returns_err() {
        let err = parse_network("devnet").unwrap_err();
        assert!(
            err.contains("unrecognised STELLAR_NETWORK value 'devnet'"),
            "unexpected error message: {err}"
        );
    }

    #[test]
    fn parse_empty_string_returns_err() {
        assert!(parse_network("").is_err());
    }

    #[test]
    fn network_as_str_values() {
        assert_eq!(StellarNetwork::Testnet.as_str(), "testnet");
        assert_eq!(StellarNetwork::Mainnet.as_str(), "mainnet");
    }

    #[test]
    fn network_horizon_urls() {
        assert_eq!(
            StellarNetwork::Testnet.horizon_url(),
            "https://horizon-testnet.stellar.org"
        );
        assert_eq!(
            StellarNetwork::Mainnet.horizon_url(),
            "https://horizon.stellar.org"
        );
    }
}
