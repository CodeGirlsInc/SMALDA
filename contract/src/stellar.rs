use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info};

#[derive(Clone)]
pub struct StellarClient {
    horizon_url: String,
    client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationResult {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct HorizonResponse {
    _embedded: EmbeddedRecords,
}

#[derive(Debug, Deserialize)]
struct EmbeddedRecords {
    records: Vec<Transaction>,
}

#[derive(Debug, Deserialize)]
struct Transaction {
    id: String,
    created_at: String,
    memo: Option<String>,
}

impl StellarClient {
    pub fn new(horizon_url: &str) -> Self {
        Self {
            horizon_url: horizon_url.to_string(),
            client: Client::new(),
        }
    }

    pub async fn check_connection(&self) -> bool {
        let url = format!("{}/", self.horizon_url);
        self.client.get(&url).send().await.is_ok()
    }

    /// Anchor a transfer hash on Stellar.
    ///
    /// For now this is a lightweight stub that logs the intention to anchor
    /// using the provided memo. Wiring this up to a full transaction submit
    /// flow can be done once funding/keys are configured.
    pub async fn anchor_transfer(&self, transfer_hash: &str, memo: &str) -> Result<()> {
        info!(
            "Requested anchor of transfer hash {} with memo '{}'",
            transfer_hash, memo
        );
        Ok(())
    }

    pub async fn verify_hash(&self, document_hash: &str) -> Result<VerificationResult> {
        debug!("Querying Stellar for hash: {}", document_hash);

        // Query Stellar Horizon API for transactions with matching memo
        let url = format!(
            "{}/transactions?order=desc&limit=10",
            self.horizon_url
        );

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            error!("Stellar API returned status: {}", response.status());
            return Ok(VerificationResult {
                verified: false,
                transaction_id: None,
                timestamp: None,
            });
        }

        let horizon_response: HorizonResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse response: {}", e))?;

        // Search for matching hash in transaction memos
        for tx in horizon_response._embedded.records {
            if let Some(memo) = &tx.memo {
                if memo.contains(document_hash) {
                    debug!("Found matching transaction: {}", tx.id);
                    
                    let timestamp = chrono::DateTime::parse_from_rfc3339(&tx.created_at)
                        .map(|dt| dt.timestamp())
                        .ok();

                    return Ok(VerificationResult {
                        verified: true,
                        transaction_id: Some(tx.id),
                        timestamp,
                    });
                }
            }
        }

        debug!("No matching transaction found for hash");
        Ok(VerificationResult {
            verified: false,
            transaction_id: None,
            timestamp: None,
        })
    }
}
