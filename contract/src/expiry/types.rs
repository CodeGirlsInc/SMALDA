use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiryPolicy {
    pub issued_at: i64,
    pub expires_at: i64,
    pub renewable: bool,
    pub grace_period_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExpiryStatus {
    Active,
    Expired,
    GracePeriod,
    Renewed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentExpiryRecord {
    pub document_hash: String,
    pub issued_at: i64,
    pub expires_at: i64,
    pub status: ExpiryStatus,
    pub stellar_memo: Option<String>,
    pub renewed_at: Option<i64>,
}

impl DocumentExpiryRecord {
    pub fn new(document_hash: String, policy: &ExpiryPolicy) -> Self {
        Self {
            document_hash,
            issued_at: policy.issued_at,
            expires_at: policy.expires_at,
            status: ExpiryStatus::Active,
            stellar_memo: None,
            renewed_at: None,
        }
    }

    pub fn is_expired(&self, now: i64) -> bool {
        now > self.expires_at
    }
}
