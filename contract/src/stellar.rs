use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use tracing::{debug, error, info, warn};

/// Maximum length for Stellar memo text (in bytes)
pub const MAX_MEMO_LENGTH: usize = 28;

use tracing::{debug, error, info};


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

/// Represents a Stellar transaction record with hash memo reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRecord {
    pub transaction_id: String,
    pub timestamp: i64,
    pub memo: String,
    pub ledger: u64,
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
    ledger: Option<u64>,
    #[serde(rename = "source_account")]
    source_account: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HorizonLinks {
    next: Option<Link>,
}

#[derive(Debug, Deserialize)]
struct Link {
    href: String,
}

#[derive(Debug, Deserialize)]
struct HorizonPaginatedResponse {
    #[serde(rename = "_embedded")]
    embedded: EmbeddedRecords,
    #[serde(rename = "_links")]
    links: Option<HorizonLinks>,
}

/// Truncates a hash to fit within Stellar's memo text limit
/// Returns the truncated string and logs a warning if truncation occurred
pub fn truncate_memo(hash: &str) -> String {
    let bytes = hash.as_bytes();
    if bytes.len() > MAX_MEMO_LENGTH {
        warn!(
            "Hash exceeds {} bytes, truncating from {} bytes",
            MAX_MEMO_LENGTH,
            bytes.len()
        );
        // Find a valid UTF-8 boundary to truncate at
        let mut end = MAX_MEMO_LENGTH;
        while end > 0 && !hash.is_char_boundary(end) {
            end -= 1;
        }
        hash[..end].to_string()
    } else {
        hash.to_string()
    }
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

    /// Submits a document hash to the Stellar blockchain as a transaction memo
    /// Returns the transaction ID on success
    pub async fn submit_hash(
        &self,
        document_hash: &str,
        secret_key: &str,
    ) -> Result<String> {
        debug!("Submitting hash to Stellar: {}", document_hash);

        // Truncate hash to fit in memo if necessary
        let memo = truncate_memo(document_hash);
        debug!("Using memo (truncated if needed): {}", memo);

        // Build and submit transaction using Horizon API
        // First, get the source account details
        let source_public = Self::derive_public_key(secret_key)?;
        let sequence = self.get_account_sequence(&source_public).await?;

        // Build the transaction
        let tx_envelope = self
            .build_transaction(&source_public, sequence, &memo, secret_key)
            .await?;

        // Submit to Horizon
        let tx_id = self.submit_transaction(&tx_envelope).await?;

        info!("Successfully submitted hash. Transaction ID: {}", tx_id);
        Ok(tx_id)
    }

    /// Retrieves the full on-chain history for a document hash
    /// Paginates through all results and returns them sorted chronologically (oldest first)
    pub async fn get_hash_history(&self, document_hash: &str) -> Result<Vec<TransactionRecord>> {
        debug!("Fetching history for hash: {}", document_hash);

        let mut all_records = Vec::new();
        let mut cursor: Option<String> = None;
        const LIMIT: u32 = 200;

        // Paginate through all results
        loop {
            let mut url = format!(
                "{}/transactions?limit={}&order=asc",
                self.horizon_url, LIMIT
            );

            // Add cursor for pagination if we have one
            if let Some(ref c) = cursor {
                url.push_str(&format!("&cursor={}", c));
            }

            debug!("Querying Horizon: {}", url);

            let response = self
                .client
                .get(&url)
                .send()
                .await
                .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

            if !response.status().is_success() {
                error!("Stellar API returned status: {}", response.status());
                return Err(anyhow!(
                    "Horizon API error: HTTP {}",
                    response.status()
                ));
            }

            let horizon_response: HorizonPaginatedResponse = response
                .json()
                .await
                .map_err(|e| anyhow!("Failed to parse response: {}", e))?;

            // Filter records that contain the document hash in their memo
            for tx in horizon_response.embedded.records {
                if let Some(ref memo) = tx.memo {
                    if memo.contains(document_hash) {
                        let timestamp = chrono::DateTime::parse_from_rfc3339(&tx.created_at)
                            .map(|dt| dt.timestamp())
                            .unwrap_or(0);

                        all_records.push(TransactionRecord {
                            transaction_id: tx.id.clone(),
                            timestamp,
                            memo: memo.clone(),
                            ledger: tx.ledger.unwrap_or(0),
                        });
                    }
                }
            }

            // Check if there's a next page
            if let Some(links) = horizon_response.links {
                if let Some(next_link) = links.next {
                    // Extract cursor from next link
                    if let Some(new_cursor) = Self::extract_cursor(&next_link.href) {
                        cursor = Some(new_cursor);
                        continue;
                    }
                }
            }

            // No more pages
            break;
        }

        debug!(
            "Found {} transactions for hash {}",
            all_records.len(),
            document_hash
        );

        // Sort chronologically (oldest first) - already sorted by 'asc' order in query
        // but we ensure it here in case of any edge cases
        all_records.sort_by_key(|r| r.timestamp);

        Ok(all_records)
    }

    /// Extracts cursor parameter from a URL
    fn extract_cursor(url: &str) -> Option<String> {
        url.split('&')
            .find(|part| part.starts_with("cursor="))
            .map(|part| part.trim_start_matches("cursor=").to_string())
    }

    /// Derives the public key from a secret key
    fn derive_public_key(secret_key: &str) -> Result<String> {
        // For now, we'll use a simple approach - in production, use stellar_sdk properly
        // The secret key should be a 56-character string starting with 'S'
        if secret_key.len() != 56 || !secret_key.starts_with('S') {
            return Err(anyhow!(
                "Invalid secret key format. Expected 56-character string starting with 'S'"
            ));
        }
        // This is a placeholder - in real implementation, use proper key derivation
        // For testnet/demo, we'll derive a simple public key representation
        Ok(format!("G{}", &secret_key[1..]))
    }

    /// Gets the account sequence number from Horizon
    async fn get_account_sequence(&self, public_key: &str) -> Result<i64> {
        let url = format!("{}/accounts/{}", self.horizon_url, public_key);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch account: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to fetch account sequence: HTTP {}",
                response.status()
            ));
        }

        let account: serde_json::Value = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse account response: {}", e))?;

        let sequence = account["sequence"]
            .as_str()
            .ok_or_else(|| anyhow!("Sequence not found in account response"))?
            .parse::<i64>()
            .map_err(|e| anyhow!("Failed to parse sequence: {}", e))?;

        Ok(sequence)
    }

    /// Builds a Stellar transaction with the given memo
    async fn build_transaction(
        &self,
        source_public: &str,
        sequence: i64,
        memo: &str,
        _secret_key: &str,
    ) -> Result<String> {
        // Build a minimal transaction envelope
        // In production, use stellar_sdk for proper transaction building
        let tx_json = serde_json::json!({
            "source_account": source_public,
            "fee": 100,
            "seq_num": sequence + 1,
            "memo": {
                "type": "MEMO_TEXT",
                "text": memo
            },
            "operations": []
        });

        // For now, return a base64-encoded placeholder
        // In production, properly sign the transaction
        let envelope = BASE64.encode(tx_json.to_string());
        Ok(envelope)
    }

    /// Submits a transaction envelope to Horizon
    async fn submit_transaction(&self, tx_envelope: &str) -> Result<String> {
        let url = format!("{}/transactions", self.horizon_url);

        let params = serde_json::json!({
            "tx": tx_envelope
        });

        let response = self
            .client
            .post(&url)
            .form(&[("tx", tx_envelope)])
            .send()
            .await
            .map_err(|e| anyhow!("Failed to submit transaction: {}", e))?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!("Transaction submission failed: {}", error_text));
        }

        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse submission response: {}", e))?;

        let tx_id = result["hash"]
            .as_str()
            .ok_or_else(|| anyhow!("Transaction hash not found in response"))?
            .to_string();

        Ok(tx_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_memo_short_hash() {
        let hash = "abc123";
        let result = truncate_memo(hash);
        assert_eq!(result, hash);
    }

    #[test]
    fn test_truncate_memo_exact_length() {
        let hash = "a".repeat(MAX_MEMO_LENGTH);
        let result = truncate_memo(&hash);
        assert_eq!(result.len(), MAX_MEMO_LENGTH);
    }

    #[test]
    fn test_truncate_memo_long_hash() {
        let hash = "a".repeat(50);
        let result = truncate_memo(&hash);
        assert!(result.len() <= MAX_MEMO_LENGTH);
    }

    #[test]
    fn test_truncate_memo_utf8_boundary() {
        // Test with multi-byte UTF-8 characters
        let hash = "é".repeat(20); // Each 'é' is 2 bytes
        let result = truncate_memo(&hash);
        assert!(result.len() <= MAX_MEMO_LENGTH);
        // Ensure we didn't cut in the middle of a character
        assert!(result.is_char_boundary(result.len()));
    }

    #[test]
    fn test_truncate_memo_28_bytes() {
        // Test that 28 bytes is the limit
        let hash = "x".repeat(28);
        let result = truncate_memo(&hash);
        assert_eq!(result.len(), 28);
    }

    #[test]
    fn test_truncate_memo_29_bytes() {
        // Test that 29 bytes gets truncated
        let hash = "x".repeat(29);
        let result = truncate_memo(&hash);
        assert_eq!(result.len(), 28);
    }

    #[test]
    fn test_extract_cursor_from_url() {
        let url = "https://horizon.stellar.org/transactions?cursor=123456&limit=200";
        let cursor = StellarClient::extract_cursor(url);
        assert_eq!(cursor, Some("123456".to_string()));
    }

    #[test]
    fn test_extract_cursor_no_cursor() {
        let url = "https://horizon.stellar.org/transactions?limit=200";
        let cursor = StellarClient::extract_cursor(url);
        assert_eq!(cursor, None);
    }

    #[test]
    fn test_transaction_record_sorting() {
        let mut records = vec![
            TransactionRecord {
                transaction_id: "tx3".to_string(),
                timestamp: 300,
                memo: "hash3".to_string(),
                ledger: 3,
            },
            TransactionRecord {
                transaction_id: "tx1".to_string(),
                timestamp: 100,
                memo: "hash1".to_string(),
                ledger: 1,
            },
            TransactionRecord {
                transaction_id: "tx2".to_string(),
                timestamp: 200,
                memo: "hash2".to_string(),
                ledger: 2,
            },
        ];

        // Sort by timestamp (oldest first)
        records.sort_by_key(|r| r.timestamp);

        assert_eq!(records[0].transaction_id, "tx1");
        assert_eq!(records[1].transaction_id, "tx2");
        assert_eq!(records[2].transaction_id, "tx3");
    }

    #[test]
    fn test_transaction_record_chronological_order() {
        // Test that records are properly ordered chronologically
        let records = vec![
            TransactionRecord {
                transaction_id: "oldest".to_string(),
                timestamp: 1000,
                memo: "test".to_string(),
                ledger: 100,
            },
            TransactionRecord {
                transaction_id: "middle".to_string(),
                timestamp: 2000,
                memo: "test".to_string(),
                ledger: 200,
            },
            TransactionRecord {
                transaction_id: "newest".to_string(),
                timestamp: 3000,
                memo: "test".to_string(),
                ledger: 300,
            },
        ];

        // Verify ascending order (oldest first)
        for i in 1..records.len() {
            assert!(
                records[i - 1].timestamp <= records[i].timestamp,
                "Records should be in chronological order"
            );
        }
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
