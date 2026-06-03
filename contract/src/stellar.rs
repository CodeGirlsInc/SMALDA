use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct StellarClient {
    horizon_url: String,
    http_client: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransactionRecord {
    pub transaction_id: String,
    pub timestamp: i64,
    pub verified: bool,
}

pub struct VerificationResult {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
}

impl StellarClient {
    pub fn new(horizon_url: &str) -> Self {
        Self {
            horizon_url: horizon_url.to_string(),
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn check_connection(&self) -> bool {
        self.http_client
            .get(&self.horizon_url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    pub async fn verify_hash(&self, hash: &str) -> Result<VerificationResult> {
        let url = format!("{}/transactions?memo={}", self.horizon_url, hash);
        let resp = self.http_client.get(&url).send().await?;

        if resp.status().is_success() {
            Ok(VerificationResult {
                verified: true,
                transaction_id: Some(String::new()),
                timestamp: Some(0),
            })
        } else {
            Ok(VerificationResult {
                verified: false,
                transaction_id: None,
                timestamp: None,
            })
        }
    }

    pub async fn anchor_transfer(&self, _transfer_hash: &str, _memo: &str) -> Result<()> {
        Ok(())
    }
}
