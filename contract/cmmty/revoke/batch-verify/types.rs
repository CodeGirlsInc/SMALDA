use serde::{Deserialize, Serialize};

/// Request body for `POST /cmmty/verify/batch`.
#[derive(Debug, Deserialize)]
pub struct BatchVerifyRequest {
    /// List of document hashes to verify. Maximum 50 entries.
    pub hashes: Vec<String>,
}

/// The verification result for a single hash.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashResult {
    /// The document hash that was queried.
    pub hash: String,

    /// `true` if the hash is anchored on Stellar and has NOT been revoked.
    pub verified: bool,

    /// `true` if a revocation record exists for this hash.
    /// `None` when a Stellar error prevented the revocation check.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revoked: Option<bool>,

    /// The Stellar transaction ID of the anchor operation, if found.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_id: Option<String>,

    /// ISO-8601 timestamp from the anchor ledger close time.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchored_at: Option<String>,
}

/// Response body for `POST /cmmty/verify/batch`.
#[derive(Debug, Serialize)]
pub struct BatchVerifyResponse {
    /// One result per hash, in the same order as the request.
    pub results: Vec<HashResult>,
}