use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{debug, error, warn};

#[derive(Clone, Debug)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        let max_attempts = std::env::var("STELLAR_MAX_RETRIES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);

        Self {
            max_attempts,
            initial_delay_ms: 100,
            max_delay_ms: 10000,
            backoff_multiplier: 2.0,
        }
    }
}

async fn retry_async<F, Fut, T>(config: &RetryConfig, mut operation: F) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut attempt = 1;
    let mut delay_ms = config.initial_delay_ms;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                let should_retry = is_retryable_error(&e);
                
                if !should_retry || attempt >= config.max_attempts {
                    return Err(e);
                }

                // Apply jitter: actual_delay = delay * (0.8 + random * 0.4)
                let jitter = 0.8 + rand::random::<f64>() * 0.4;
                let actual_delay_ms = (delay_ms as f64 * jitter) as u64;
                let actual_delay_ms = actual_delay_ms.min(config.max_delay_ms);

                warn!(
                    "Retry attempt {}/{} after {}ms delay. Error: {}",
                    attempt, config.max_attempts, actual_delay_ms, e
                );

                sleep(Duration::from_millis(actual_delay_ms)).await;

                // Calculate next delay with exponential backoff
                delay_ms = ((delay_ms as f64 * config.backoff_multiplier) as u64)
                    .min(config.max_delay_ms);
                
                attempt += 1;
            }
        }
    }
}

fn is_retryable_error(error: &anyhow::Error) -> bool {
    let error_msg = error.to_string().to_lowercase();
    
    // Check for network errors
    if error_msg.contains("connection refused")
        || error_msg.contains("timeout")
        || error_msg.contains("connection reset")
        || error_msg.contains("broken pipe")
        || error_msg.contains("network")
    {
        return true;
    }

    // Check for HTTP 5xx errors
    if error_msg.contains("status: 5") || error_msg.contains("server error") {
        return true;
    }

    // Check if it's a reqwest error with retryable status
    if let Some(source) = error.source() {
        if let Some(reqwest_err) = source.downcast_ref::<reqwest::Error>() {
            if reqwest_err.is_timeout() || reqwest_err.is_connect() {
                return true;
            }
            
            if let Some(status) = reqwest_err.status() {
                return status.is_server_error();
            }
        }
    }

    false
}

#[derive(Clone)]
pub struct StellarClient {
    horizon_url: String,
    client: Client,
    retry_config: RetryConfig,
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
            retry_config: RetryConfig::default(),
        }
    }

    pub fn with_retry_config(horizon_url: &str, retry_config: RetryConfig) -> Self {
        Self {
            horizon_url: horizon_url.to_string(),
            client: Client::new(),
            retry_config,
        }
    }

    pub async fn check_connection(&self) -> bool {
        let url = format!("{}/", self.horizon_url);
        self.client.get(&url).send().await.is_ok()
    }

    pub async fn verify_hash(&self, document_hash: &str) -> Result<VerificationResult> {
        debug!("Querying Stellar for hash: {}", document_hash);

        let document_hash = document_hash.to_string();
        let horizon_url = self.horizon_url.clone();
        let client = self.client.clone();

        retry_async(&self.retry_config, || {
            let document_hash = document_hash.clone();
            let horizon_url = horizon_url.clone();
            let client = client.clone();
            
            async move {
                // Query Stellar Horizon API for transactions with matching memo
                let url = format!("{}/transactions?order=desc&limit=10", horizon_url);

                let response = client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

                let status = response.status();
                
                // Return error for 5xx (will be retried)
                if status.is_server_error() {
                    return Err(anyhow!("Stellar API returned server error: {}", status));
                }

                // Return success with unverified result for 4xx (will NOT be retried)
                if status.is_client_error() {
                    error!("Stellar API returned client error: {}", status);
                    return Ok(VerificationResult {
                        verified: false,
                        transaction_id: None,
                        timestamp: None,
                    });
                }

                if !status.is_success() {
                    error!("Stellar API returned status: {}", status);
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
                        if memo.contains(&document_hash) {
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
        })
        .await
    }

    pub async fn submit_hash(&self, document_hash: &str) -> Result<String> {
        debug!("Submitting hash to Stellar: {}", document_hash);

        let document_hash = document_hash.to_string();
        let horizon_url = self.horizon_url.clone();
        let client = self.client.clone();

        retry_async(&self.retry_config, || {
            let document_hash = document_hash.clone();
            let horizon_url = horizon_url.clone();
            let client = client.clone();
            
            async move {
                let url = format!("{}/transactions", horizon_url);

                let response = client
                    .post(&url)
                    .json(&serde_json::json!({
                        "memo": document_hash,
                    }))
                    .send()
                    .await
                    .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

                let status = response.status();
                
                // Return error for 5xx (will be retried)
                if status.is_server_error() {
                    return Err(anyhow!("Stellar API returned server error: {}", status));
                }

                // Return error for 4xx (will NOT be retried)
                if status.is_client_error() {
                    return Err(anyhow!("Stellar API returned client error: {}", status));
                }

                if !status.is_success() {
                    return Err(anyhow!("Stellar API returned status: {}", status));
                }

                let result: serde_json::Value = response
                    .json()
                    .await
                    .map_err(|e| anyhow!("Failed to parse response: {}", e))?;

                let transaction_id = result["id"]
                    .as_str()
                    .ok_or_else(|| anyhow!("Transaction ID not found in response"))?
                    .to_string();

                debug!("Hash submitted successfully: {}", transaction_id);
                Ok(transaction_id)
            }
        })
        .await
    }

    pub async fn get_hash_history(&self, limit: u32) -> Result<Vec<VerificationResult>> {
        debug!("Fetching hash history with limit: {}", limit);

        let horizon_url = self.horizon_url.clone();
        let client = self.client.clone();

        retry_async(&self.retry_config, || {
            let horizon_url = horizon_url.clone();
            let client = client.clone();
            
            async move {
                let url = format!(
                    "{}/transactions?order=desc&limit={}",
                    horizon_url, limit
                );

                let response = client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

                let status = response.status();
                
                // Return error for 5xx (will be retried)
                if status.is_server_error() {
                    return Err(anyhow!("Stellar API returned server error: {}", status));
                }

                // Return error for 4xx (will NOT be retried)
                if status.is_client_error() {
                    return Err(anyhow!("Stellar API returned client error: {}", status));
                }

                if !status.is_success() {
                    return Err(anyhow!("Stellar API returned status: {}", status));
                }

                let horizon_response: HorizonResponse = response
                    .json()
                    .await
                    .map_err(|e| anyhow!("Failed to parse response: {}", e))?;

                let results: Vec<VerificationResult> = horizon_response
                    ._embedded
                    .records
                    .into_iter()
                    .filter_map(|tx| {
                        tx.memo.map(|memo| {
                            let timestamp = chrono::DateTime::parse_from_rfc3339(&tx.created_at)
                                .map(|dt| dt.timestamp())
                                .ok();

                            VerificationResult {
                                verified: true,
                                transaction_id: Some(tx.id),
                                timestamp,
                            }
                        })
                    })
                    .collect();

                debug!("Retrieved {} transactions from history", results.len());
                Ok(results)
            }
        })
        .await
    }
}

    pub async fn revoke_hash(&self, document_hash: &str, reason: &str, revoked_by: &str) -> Result<String> {
        debug!("Revoking hash on Stellar: {}", document_hash);

        let document_hash = document_hash.to_string();
        let reason = reason.to_string();
        let revoked_by = revoked_by.to_string();
        let horizon_url = self.horizon_url.clone();
        let client = self.client.clone();

        retry_async(&self.retry_config, || {
            let document_hash = document_hash.clone();
            let reason = reason.clone();
            let revoked_by = revoked_by.clone();
            let horizon_url = horizon_url.clone();
            let client = client.clone();
            
            async move {
                // Create structured memo: "REVOKE:<hash>" (truncated to 28 bytes)
                let memo_content = format!("REVOKE:{}", document_hash);
                let memo = if memo_content.len() > 28 {
                    &memo_content[..28]
                } else {
                    &memo_content
                };

                let url = format!("{}/transactions", horizon_url);

                let response = client
                    .post(&url)
                    .json(&serde_json::json!({
                        "memo": memo,
                        "memo_type": "text",
                    }))
                    .send()
                    .await
                    .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

                let status = response.status();
                
                // Return error for 5xx (will be retried)
                if status.is_server_error() {
                    return Err(anyhow!("Stellar API returned server error: {}", status));
                }

                // Return error for 4xx (will NOT be retried)
                if status.is_client_error() {
                    return Err(anyhow!("Stellar API returned client error: {}", status));
                }

                if !status.is_success() {
                    return Err(anyhow!("Stellar API returned status: {}", status));
                }

                let result: serde_json::Value = response
                    .json()
                    .await
                    .map_err(|e| anyhow!("Failed to parse response: {}", e))?;

                let transaction_id = result["id"]
                    .as_str()
                    .ok_or_else(|| anyhow!("Transaction ID not found in response"))?
                    .to_string();

                debug!("Hash revoked successfully: {}", transaction_id);
                Ok(transaction_id)
            }
        })
        .await
    }
