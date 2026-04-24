use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};

pub const DEFAULT_TOLERANCE_SECONDS: i64 = 60;

#[derive(Debug, Deserialize)]
pub struct TimestampVerifyRequest {
    pub hash: String,
    pub expected_timestamp: i64,
    pub tolerance_seconds: Option<i64>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct TimestampVerifyResponse {
    pub valid: bool,
    pub anchored_at: Option<i64>,
    pub delta_seconds: Option<i64>,
}

/// Core verification logic: compare `anchored_at` against `expected` within tolerance.
pub fn verify(
    anchored_at: Option<i64>,
    expected: i64,
    tolerance: i64,
) -> TimestampVerifyResponse {
    match anchored_at {
        None => TimestampVerifyResponse {
            valid: false,
            anchored_at: None,
            delta_seconds: None,
        },
        Some(ts) => {
            let delta = (ts - expected).abs();
            TimestampVerifyResponse {
                valid: delta <= tolerance,
                anchored_at: Some(ts),
                delta_seconds: Some(delta),
            }
        }
    }
}

/// Looks up the anchored timestamp for `hash` from the in-memory store (stub).
/// In production this would query Stellar Horizon or a cache.
pub fn lookup_anchored_at(hash: &str) -> Option<i64> {
    // Stub: a real implementation queries Horizon or a local cache.
    let _ = hash;
    None
}

/// POST /cmmty/verify/timestamp
pub async fn handler(
    Json(req): Json<TimestampVerifyRequest>,
) -> Result<Json<TimestampVerifyResponse>, StatusCode> {
    let tolerance = req.tolerance_seconds.unwrap_or(DEFAULT_TOLERANCE_SECONDS);
    let anchored_at = lookup_anchored_at(&req.hash);
    Ok(Json(verify(anchored_at, req.expected_timestamp, tolerance)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn within_tolerance_is_valid() {
        let resp = verify(Some(1000), 1000, 60);
        assert!(resp.valid);
        assert_eq!(resp.anchored_at, Some(1000));
        assert_eq!(resp.delta_seconds, Some(0));
    }

    #[test]
    fn out_of_tolerance_is_invalid() {
        let resp = verify(Some(1200), 1000, 60);
        assert!(!resp.valid);
        assert_eq!(resp.delta_seconds, Some(200));
    }

    #[test]
    fn hash_not_found_returns_invalid() {
        let resp = verify(None, 1000, 60);
        assert!(!resp.valid);
        assert_eq!(resp.anchored_at, None);
        assert_eq!(resp.delta_seconds, None);
    }
}
