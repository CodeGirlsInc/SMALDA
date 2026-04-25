use serde::{Deserialize, Serialize};

/// Request body for `POST /cmmty/revoke`.
#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    /// The document hash (hex string) that should be marked as revoked.
    pub hash: String,
}

/// Successful response for `POST /cmmty/revoke`.
#[derive(Debug, Serialize)]
pub struct RevokeResponse {
    /// The Stellar transaction hash of the revocation record.
    pub tx_hash: String,
    /// ISO-8601 / RFC-3339 timestamp of when the revocation was written.
    pub revoked_at: String,
}