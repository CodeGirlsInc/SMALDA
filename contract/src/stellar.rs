use anyhow::{anyhow, Result};
use base64::Engine as _;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use stellar_base::{
    account::DataValue,
    crypto::KeyPair,
    network::Network,
    operations::Operation,
    transaction::{Transaction, TransactionEnvelope, MIN_BASE_FEE},
    xdr::XDRSerialize,
};
use tracing::info;

use crate::retry::{with_retry_and_cb, CircuitBreaker, CircuitState, RetryPolicy, RetryableError};

#[derive(Debug, Clone)]
pub struct StellarClient {
    horizon_url: String,
    http_client: reqwest::Client,
    /// Shared circuit breaker that tracks Horizon-call health.
    circuit_breaker: Arc<CircuitBreaker>,
    /// Active retry policy (max_attempts, backoff, jitter).
    retry_policy: RetryPolicy,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TransactionRecord {
    pub transaction_id: String,
    pub timestamp: i64,
    pub verified: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerificationResult {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub data_key: Option<String>,
    pub raw_value: Option<String>,
    pub decoded_value: Option<String>,
}

/// Verification details matching NestJS verification response payload format.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerificationRecord {
    pub hash: String,
    pub anchored: bool,
    pub data_key: String,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub raw_value_base64: Option<String>,
    pub decoded_value: Option<String>,
}

/// History entry for GET /verify/:hash/history (CT-03 / CT-04 compatibility).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub id: String,
    pub transaction_hash: String,
    pub created_at: String,
    pub data_name: String,
    pub data_value_base64: Option<String>,
    pub decoded_value: Option<String>,
}

/// Successful result returned by [`StellarClient::anchor_hash`].
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnchorResult {
    /// Stellar transaction hash.
    pub tx_hash: String,
    /// Ledger sequence number where the transaction was included.
    pub ledger: u32,
    /// Unix timestamp (seconds) when the transaction was anchored.
    pub anchored_at: i64,
}

/// Horizon account object (subset of fields).
#[derive(Debug, Deserialize)]
struct HorizonAccount {
    sequence: String,
    #[serde(default)]
    data: HashMap<String, String>,
}

/// Horizon transaction submission response (subset of fields).
#[derive(Debug, Deserialize)]
struct HorizonTxResponse {
    hash: String,
    ledger: u32,
    created_at: Option<String>,
}

/// Horizon error envelope returned on failure.
#[derive(Debug, Deserialize)]
struct HorizonError {
    detail: Option<String>,
    title: Option<String>,
}

/// Horizon operation list response.
#[derive(Debug, Deserialize)]
struct OperationsResponse {
    _embedded: OperationsEmbedded,
}

#[derive(Debug, Deserialize)]
struct OperationsEmbedded {
    records: Vec<OperationRecord>,
}

#[derive(Debug, Deserialize)]
struct OperationRecord {
    id: String,
    transaction_hash: String,
    created_at: String,
    #[serde(rename = "type")]
    op_type: String,
    name: Option<String>,
    value: Option<String>,
}

impl StellarClient {
    /// Create a new client with sensible timeout and connection-pool defaults.
    pub fn new(horizon_url: &str) -> Self {
        let http_client = reqwest::Client::builder()
            // Hard deadline per request so one slow Horizon call cannot
            // block a thread indefinitely.
            .timeout(std::time::Duration::from_secs(10))
            // Keep-alive pool limits.
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .build()
            .expect("failed to build reqwest client");

        Self {
            horizon_url: horizon_url.to_string(),
            http_client,
            circuit_breaker: CircuitBreaker::with_defaults(),
            retry_policy: RetryPolicy::default(),
        }
    }

    #[tracing::instrument(name = "stellar.check_connection", skip(self))]
    pub async fn check_connection(&self) -> bool {
        match self.http_client.get(&self.horizon_url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    /// Return the base Horizon URL this client targets.
    pub fn horizon_url(&self) -> &str {
        &self.horizon_url
    }

    /// Build a client with a custom retry policy and circuit breaker.
    /// Used by integration tests to inject deterministic behaviour.
    pub fn with_policy(
        horizon_url: &str,
        retry_policy: RetryPolicy,
        circuit_breaker: Arc<CircuitBreaker>,
    ) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .build()
            .expect("failed to build reqwest client");
        Self {
            horizon_url: horizon_url.to_string(),
            http_client,
            circuit_breaker,
            retry_policy,
        }
    }

    /// Current circuit-breaker state.
    pub fn circuit_state(&self) -> CircuitState {
        self.circuit_breaker.state()
    }

    /// Human-readable label for the current circuit-breaker state.
    pub fn circuit_state_label(&self) -> &'static str {
        self.circuit_breaker.state_label()
    }

    /// Number of consecutive failures seen by the breaker.
    pub fn circuit_failures(&self) -> u32 {
        self.circuit_breaker.failures()
    }

    /// Execute a GET request wrapped in the retry policy and circuit breaker.
    ///
    /// Returns `Ok(resp)` for any Horizon response (including 4xx/5xx -- the
    /// caller decides how to map non-2xx). Returns `Err(anyhow::Error)`
    /// only when the breaker is open up-front, or the retry budget is
    /// exhausted on purely transport-level failures.
    async fn get_with_backoff(&self, url: &str) -> anyhow::Result<reqwest::Response> {
        let breaker = self.circuit_breaker.clone();
        let policy = self.retry_policy.clone();
        let client = self.http_client.clone();
        let url_owned = url.to_string();
        with_retry_and_cb(&breaker, &policy, move || {
            let client = client.clone();
            let url_owned = url_owned.clone();
            async move {
                match client.get(&url_owned).send().await {
                    Ok(resp) => Ok(resp),
                    Err(e) => Err(RetryableError::Retryable(format!(
                        "HTTP GET {url_owned} failed: {e}"
                    ))),
                }
            }
        })
        .await
        .map_err(|e| anyhow::anyhow!("horizon GET {url}: {}", e.into_string()))
    }

    /// POST a form-urlencoded envelope to Horizon, wrapped in the retry
    /// policy and circuit breaker.
    ///
    /// Callers must build the envelope / form_body OUTSIDE this helper:
    /// the same bytes are re-sent on every retry, but re-signing and
    /// re-fetching the source sequence must happen once at the caller to
    /// keep POSTs idempotent under retry.
    async fn horizon_post(&self, url: &str, body: String) -> anyhow::Result<reqwest::Response> {
        let breaker = self.circuit_breaker.clone();
        let policy = self.retry_policy.clone();
        let client = self.http_client.clone();
        let url_owned = url.to_string();
        with_retry_and_cb(&breaker, &policy, move || {
            let client = client.clone();
            let url_owned = url_owned.clone();
            let body = body.clone();
            async move {
                match client
                    .post(&url_owned)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .body(body)
                    .send()
                    .await
                {
                    Ok(resp) => Ok(resp),
                    Err(e) => Err(RetryableError::Retryable(format!(
                        "HTTP POST {url_owned} failed: {e}"
                    ))),
                }
            }
        })
        .await
        .map_err(|e| anyhow::anyhow!("horizon POST {url}: {}", e.into_string()))
    }

    /// Verifies a document hash against Horizon using the `ManageData` approach.
    ///
    /// Reads `account.data_attr` for key `"doc_" + &hash[..58]`.
    #[tracing::instrument(
        name = "stellar.verify_hash",
        skip(self, hash),
        fields(hash_prefix = %hash_prefix(hash), anchor_account_id = %anchor_account_id)
    )]
    pub async fn verify_hash(
        &self,
        hash: &str,
        anchor_account_id: &str,
    ) -> Result<VerificationRecord> {
        let account_url = format!("{}/accounts/{}", self.horizon_url, anchor_account_id);
        let resp = self
            .get_with_backoff(&account_url)
            .await
            .map_err(|e| anyhow!("Failed to fetch account info from Horizon: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            return Err(anyhow!(
                "Horizon account fetch failed with status {}",
                status
            ));
        }

        let account: HorizonAccount = resp.json().await?;
        let data_key = build_data_key(hash);

        if let Some(b64_val) = account.data.get(&data_key) {
            let decoded_bytes = base64::engine::general_purpose::STANDARD
                .decode(b64_val)
                .unwrap_or_else(|_| b64_val.as_bytes().to_vec());
            let decoded_str = String::from_utf8_lossy(&decoded_bytes).to_string();

            Ok(VerificationRecord {
                hash: hash.to_string(),
                anchored: true,
                data_key,
                transaction_id: None,
                timestamp: None,
                raw_value_base64: Some(b64_val.clone()),
                decoded_value: Some(decoded_str),
            })
        } else {
            Ok(VerificationRecord {
                hash: hash.to_string(),
                anchored: false,
                data_key,
                transaction_id: None,
                timestamp: None,
                raw_value_base64: None,
                decoded_value: None,
            })
        }
    }

    /// Fetches all ManageData history entries for a given document hash (anchors, updates, transfers).
    #[tracing::instrument(
        name = "stellar.get_hash_history",
        skip(self, hash),
        fields(hash_prefix = %hash_prefix(hash), anchor_account_id = %anchor_account_id)
    )]
    pub async fn get_hash_history(
        &self,
        hash: &str,
        anchor_account_id: &str,
    ) -> Result<Vec<HistoryEntry>> {
        let data_key = build_data_key(hash);
        let transfer_key = build_transfer_key(hash);
        let revocation_key = build_revocation_key(hash);

        let url = format!(
            "{}/accounts/{}/operations?order=desc&limit=200",
            self.horizon_url, anchor_account_id
        );

        let resp = self
            .get_with_backoff(&url)
            .await
            .map_err(|e| anyhow!("Failed to fetch account operations: {}", e))?;

        if !resp.status().is_success() {
            return Err(anyhow!(
                "Horizon operations fetch failed with status {}",
                resp.status()
            ));
        }

        let ops: OperationsResponse = resp.json().await?;
        let mut history = Vec::new();

        for op in ops._embedded.records {
            if op.op_type == "manage_data" {
                if let Some(ref name) = op.name {
                    if name == &data_key || name == &transfer_key || name == &revocation_key {
                        let decoded_value = op.value.as_ref().map(|v| {
                            base64::engine::general_purpose::STANDARD
                                .decode(v)
                                .map(|bytes| String::from_utf8_lossy(&bytes).to_string())
                                .unwrap_or_else(|_| v.clone())
                        });

                        history.push(HistoryEntry {
                            id: op.id,
                            transaction_hash: op.transaction_hash,
                            created_at: op.created_at,
                            data_name: name.clone(),
                            data_value_base64: op.value,
                            decoded_value,
                        });
                    }
                }
            }
        }

        Ok(history)
    }

    /// Anchor a transfer record on Stellar using a `ManageData` operation.
    #[tracing::instrument(
        name = "stellar.anchor_transfer",
        skip(self, transfer_hash, secret_key),
        fields(hash_prefix = %hash_prefix(transfer_hash), public_key = %public_key)
    )]
    pub async fn anchor_transfer(
        &self,
        transfer_hash: &str,
        public_key: &str,
        secret_key: &str,
    ) -> Result<AnchorResult> {
        info!(
            "Anchoring transfer record {} via ManageData (account: {})",
            &transfer_hash[..transfer_hash.len().min(16)],
            public_key
        );

        let account_url = format!("{}/accounts/{}", self.horizon_url, public_key);
        let acct_resp = self
            .http_client
            .get(&account_url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch account info: {}", e))?;

        if !acct_resp.status().is_success() {
            return Err(anyhow!(
                "Horizon {} when fetching account {}",
                acct_resp.status().as_u16(),
                public_key
            ));
        }

        let acct: HorizonAccount = acct_resp.json().await?;
        let sequence: i64 = acct
            .sequence
            .parse()
            .map_err(|_| anyhow!("Could not parse account sequence"))?;

        let transfer_key = build_transfer_key(transfer_hash);
        let data_value = DataValue::from_slice(transfer_hash.as_bytes())
            .map_err(|e| anyhow!("DataValue error: {:?}", e))?;

        let op = Operation::new_manage_data()
            .with_data_name(transfer_key)
            .with_data_value(Some(data_value))
            .build()
            .map_err(|e| anyhow!("Failed to build ManageData operation: {:?}", e))?;

        let keypair = KeyPair::from_secret_seed(secret_key)
            .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;

        let network = if self.horizon_url.contains("testnet") {
            Network::new_test()
        } else {
            Network::new_public()
        };

        let mut tx = Transaction::builder(keypair.public_key().clone(), sequence, MIN_BASE_FEE)
            .add_operation(op)
            .into_transaction()
            .map_err(|e| anyhow!("Failed to build transaction: {:?}", e))?;

        tx.sign(&keypair, &network)
            .map_err(|e| anyhow!("Failed to sign transaction: {:?}", e))?;

        let envelope: TransactionEnvelope = tx.into_envelope();
        let xdr_bytes = envelope
            .xdr_bytes()
            .map_err(|e| anyhow!("XDR serialization failed: {:?}", e))?;
        let xdr_b64 = base64::engine::general_purpose::STANDARD.encode(&xdr_bytes);

        let submit_url = format!("{}/transactions", self.horizon_url);
        let form_body = format!("tx={}", urlencoding::encode(&xdr_b64));

        let submit_resp = self
            .horizon_post(&submit_url, form_body)
            .await
            .map_err(|e| anyhow!("Transaction submission failed: {}", e))?;

        if submit_resp.status().is_success() {
            let tx_resp: HorizonTxResponse = submit_resp.json().await?;
            let anchored_at = tx_resp
                .created_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.timestamp())
                .unwrap_or_else(|| Utc::now().timestamp());

            Ok(AnchorResult {
                tx_hash: tx_resp.hash,
                ledger: tx_resp.ledger,
                anchored_at,
            })
        } else {
            let status_code = submit_resp.status().as_u16();
            let err_text = submit_resp.text().await.unwrap_or_default();
            let detail = serde_json::from_str::<HorizonError>(&err_text)
                .ok()
                .and_then(|e| e.detail.or(e.title))
                .unwrap_or(err_text);
            Err(anyhow!(
                "Horizon transfer anchor {} — {}",
                status_code,
                detail
            ))
        }
    }

    /// Anchor a document hash to Stellar using a `ManageData` operation.
    ///
    /// # Key format
    /// `"doc_" + &hash[..58]` — matches NestJS `buildDataKey()`.
    #[tracing::instrument(
        name = "stellar.anchor_hash",
        skip(self, hash, secret_key),
        fields(hash_prefix = %hash_prefix(hash), public_key = %public_key)
    )]
    pub async fn anchor_hash(
        &self,
        hash: &str,
        public_key: &str,
        secret_key: &str,
    ) -> Result<AnchorResult> {
        info!(
            "Anchoring hash {} via ManageData (account: {})",
            &hash[..hash.len().min(16)],
            public_key
        );

        let account_url = format!("{}/accounts/{}", self.horizon_url, public_key);
        let acct_resp = self
            .http_client
            .get(&account_url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch account info: {}", e))?;

        if !acct_resp.status().is_success() {
            let status = acct_resp.status().as_u16();
            return Err(anyhow!(
                "Horizon {} when fetching account {}",
                status,
                public_key
            ));
        }
        let acct: HorizonAccount = acct_resp.json().await?;
        let sequence: i64 = acct
            .sequence
            .parse()
            .map_err(|_| anyhow!("Could not parse account sequence"))?;

        let data_key = build_data_key(hash);
        let data_value = DataValue::from_slice(hash.as_bytes())
            .map_err(|e| anyhow!("DataValue error: {:?}", e))?;

        let op = Operation::new_manage_data()
            .with_data_name(data_key)
            .with_data_value(Some(data_value))
            .build()
            .map_err(|e| anyhow!("Failed to build ManageData operation: {:?}", e))?;

        let keypair = KeyPair::from_secret_seed(secret_key)
            .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;

        let network = if self.horizon_url.contains("testnet") {
            Network::new_test()
        } else {
            Network::new_public()
        };

        let mut tx = Transaction::builder(keypair.public_key().clone(), sequence, MIN_BASE_FEE)
            .add_operation(op)
            .into_transaction()
            .map_err(|e| anyhow!("Failed to build transaction: {:?}", e))?;

        tx.sign(&keypair, &network)
            .map_err(|e| anyhow!("Failed to sign transaction: {:?}", e))?;

        let envelope: TransactionEnvelope = tx.into_envelope();
        let xdr_bytes = envelope
            .xdr_bytes()
            .map_err(|e| anyhow!("XDR serialization failed: {:?}", e))?;
        let xdr_b64 = base64::engine::general_purpose::STANDARD.encode(&xdr_bytes);

        let submit_url = format!("{}/transactions", self.horizon_url);
        let form_body = format!("tx={}", urlencoding::encode(&xdr_b64));

        let submit_resp = self
            .horizon_post(&submit_url, form_body)
            .await
            .map_err(|e| anyhow!("Transaction submission failed: {}", e))?;

        if submit_resp.status().is_success() {
            let tx_resp: HorizonTxResponse = submit_resp.json().await?;
            let anchored_at = tx_resp
                .created_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.timestamp())
                .unwrap_or_else(|| Utc::now().timestamp());

            Ok(AnchorResult {
                tx_hash: tx_resp.hash,
                ledger: tx_resp.ledger,
                anchored_at,
            })
        } else {
            let status_code = submit_resp.status().as_u16();
            let err_text = submit_resp.text().await.unwrap_or_default();
            let detail = serde_json::from_str::<HorizonError>(&err_text)
                .ok()
                .and_then(|e| e.detail.or(e.title))
                .unwrap_or(err_text);
            Err(anyhow!("Horizon {} — {}", status_code, detail))
        }
    }

    /// Record a document revocation on Stellar using a `ManageData` operation.
    ///
    /// Key: `"revoked_" + &hash[..56]` (max 64 bytes).
    /// Value: the revocation JSON payload (truncated to 64 bytes).
    #[tracing::instrument(
        name = "stellar.anchor_revocation",
        skip(self, hash, revocation_json, secret_key),
        fields(hash_prefix = %hash_prefix(hash), public_key = %public_key)
    )]
    pub async fn anchor_revocation(
        &self,
        hash: &str,
        revocation_json: &str,
        public_key: &str,
        secret_key: &str,
    ) -> Result<AnchorResult> {
        info!(
            "Recording revocation for {} (account: {})",
            &hash[..hash.len().min(16)],
            public_key
        );

        let account_url = format!("{}/accounts/{}", self.horizon_url, public_key);
        let acct_resp = self
            .http_client
            .get(&account_url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch account info: {}", e))?;

        if !acct_resp.status().is_success() {
            return Err(anyhow!(
                "Horizon {} when fetching account {}",
                acct_resp.status().as_u16(),
                public_key
            ));
        }
        let acct: HorizonAccount = acct_resp.json().await?;
        let sequence: i64 = acct
            .sequence
            .parse()
            .map_err(|_| anyhow!("Could not parse account sequence"))?;

        let revocation_key = build_revocation_key(hash);

        let raw = revocation_json.as_bytes();
        let value_bytes = &raw[..raw.len().min(64)];
        let data_value =
            DataValue::from_slice(value_bytes).map_err(|e| anyhow!("DataValue error: {:?}", e))?;

        let op = Operation::new_manage_data()
            .with_data_name(revocation_key)
            .with_data_value(Some(data_value))
            .build()
            .map_err(|e| anyhow!("Failed to build ManageData operation: {:?}", e))?;

        let keypair = KeyPair::from_secret_seed(secret_key)
            .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;

        let network = if self.horizon_url.contains("testnet") {
            Network::new_test()
        } else {
            Network::new_public()
        };

        let mut tx = Transaction::builder(keypair.public_key().clone(), sequence, MIN_BASE_FEE)
            .add_operation(op)
            .into_transaction()
            .map_err(|e| anyhow!("Failed to build transaction: {:?}", e))?;

        tx.sign(&keypair, &network)
            .map_err(|e| anyhow!("Failed to sign transaction: {:?}", e))?;

        let envelope: TransactionEnvelope = tx.into_envelope();
        let xdr_bytes = envelope
            .xdr_bytes()
            .map_err(|e| anyhow!("XDR serialization failed: {:?}", e))?;
        let xdr_b64 = base64::engine::general_purpose::STANDARD.encode(&xdr_bytes);

        let submit_url = format!("{}/transactions", self.horizon_url);
        let form_body = format!("tx={}", urlencoding::encode(&xdr_b64));

        let submit_resp = self
            .horizon_post(&submit_url, form_body)
            .await
            .map_err(|e| anyhow!("Transaction submission failed: {}", e))?;

        if submit_resp.status().is_success() {
            let tx_resp: HorizonTxResponse = submit_resp.json().await?;
            let anchored_at = tx_resp
                .created_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.timestamp())
                .unwrap_or_else(|| Utc::now().timestamp());
            Ok(AnchorResult {
                tx_hash: tx_resp.hash,
                ledger: tx_resp.ledger,
                anchored_at,
            })
        } else {
            let status_code = submit_resp.status().as_u16();
            let err_text = submit_resp.text().await.unwrap_or_default();
            let detail = serde_json::from_str::<HorizonError>(&err_text)
                .ok()
                .and_then(|e| e.detail.or(e.title))
                .unwrap_or(err_text);
            Err(anyhow!("Horizon revocation {} — {}", status_code, detail))
        }
    }
}

/// Build the ManageData key: `"doc_" + &hash[..58]` (max 62 bytes ≤ 64-byte limit).
fn hash_prefix(hash: &str) -> &str {
    &hash[..hash.len().min(16)]
}

pub fn build_data_key(hash: &str) -> String {
    let suffix_len = hash.len().min(58);
    format!("doc_{}", &hash[..suffix_len])
}

/// Build the transfer ManageData key: `"trf_" + &hash[..58]` (max 62 bytes).
pub fn build_transfer_key(hash: &str) -> String {
    let suffix_len = hash.len().min(58);
    format!("trf_{}", &hash[..suffix_len])
}

/// Build the revocation ManageData key: `"revoked_" + &hash[..56]` (max 64 bytes).
pub fn build_revocation_key(hash: &str) -> String {
    let suffix_len = hash.len().min(56);
    format!("revoked_{}", &hash[..suffix_len])
}

/// Derive the Stellar account ID (public key) that reads/writes go through,
/// given the service's configured secret key. All `ManageData` entries are
/// anchored under this single account, so verification and history lookups
/// query it directly rather than requiring a caller-supplied account.
pub fn derive_account_id(secret_key: &str) -> Result<String> {
    let keypair = KeyPair::from_secret_seed(secret_key)
        .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;
    Ok(keypair.public_key().account_id())
}

/// Minimal percent-encoding for the `tx=` form field.
mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut out = String::with_capacity(s.len() * 3);
        for byte in s.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    out.push(byte as char);
                }
                b => out.push_str(&format!("%{:02X}", b)),
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    const TEST_ACCOUNT: &str = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    fn create_test_client(mock_server: &MockServer) -> StellarClient {
        StellarClient::new(&mock_server.url("/"))
    }

    // ── verify_hash (CT-34) ──────────────────────────────────────────────────

    #[tokio::test]
    async fn test_verify_hash_found_returns_anchored_with_decoded_value() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let hash = "abc123";
        let data_key = build_data_key(hash);
        let raw_value = base64::engine::general_purpose::STANDARD.encode(hash.as_bytes());

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(200).json_body(serde_json::json!({
                "sequence": "1",
                "data": { (data_key): raw_value }
            }));
        });

        let result = client.verify_hash(hash, TEST_ACCOUNT).await.unwrap();

        assert!(result.anchored);
        assert_eq!(result.data_key, data_key);
        assert_eq!(result.decoded_value.as_deref(), Some(hash));
        assert!(result.raw_value_base64.is_some());
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_not_found_returns_not_anchored() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(200).json_body(serde_json::json!({
                "sequence": "1",
                "data": {}
            }));
        });

        let result = client.verify_hash("missing", TEST_ACCOUNT).await.unwrap();

        assert!(!result.anchored);
        assert_eq!(result.decoded_value, None);
        assert_eq!(result.raw_value_base64, None);
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_horizon_404_returns_err() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(404);
        });

        let result = client.verify_hash("abc", TEST_ACCOUNT).await;
        assert!(result.is_err());
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_horizon_500_returns_err() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(500);
        });

        let result = client.verify_hash("abc", TEST_ACCOUNT).await;
        assert!(result.is_err());
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_uses_manage_data_account_lookup() {
        // Regression test: verify_hash must query the anchor account's
        // manageData entries — not the old invalid /transactions?memo= query.
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let hash = "deadbeef";

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(200).json_body(serde_json::json!({
                "sequence": "1",
                "data": {}
            }));
        });

        let result = client.verify_hash(hash, TEST_ACCOUNT).await;
        assert!(result.is_ok());
        mock.assert();
    }

    // ── check_connection ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_check_connection_success() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path("/");
            then.status(200);
        });

        assert!(client.check_connection().await);
        mock.assert();
    }

    #[tokio::test]
    async fn test_check_connection_failure() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);

        let mock = mock_server.mock(|when, then| {
            when.method(GET).path("/");
            then.status(500);
        });

        assert!(!client.check_connection().await);
        mock.assert();
    }

    // ── anchor_transfer (CT-35) ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_anchor_transfer_submits_transaction() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let secret = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        let public_key = derive_account_id(secret).unwrap();

        // Horizon account fetch (sequence used for signing).
        mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", public_key));
            then.status(200).json_body(serde_json::json!({
                "sequence": "1",
                "data": {}
            }));
        });

        // Horizon transaction submission.
        let submit_mock = mock_server.mock(|when, then| {
            when.method(POST).path("/transactions");
            then.status(200).json_body(serde_json::json!({
                "hash": "txhash123",
                "ledger": 42,
                "created_at": "2025-01-01T00:00:00Z"
            }));
        });

        let result = client
            .anchor_transfer("transfer-hash", &public_key, secret)
            .await
            .unwrap();

        assert_eq!(result.tx_hash, "txhash123");
        assert_eq!(result.ledger, 42);
        submit_mock.assert();
    }

    #[tokio::test]
    async fn test_anchor_transfer_horizon_failure_returns_err() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let secret = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        let public_key = derive_account_id(secret).unwrap();

        mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", public_key));
            then.status(200).json_body(serde_json::json!({
                "sequence": "1",
                "data": {}
            }));
        });
        let submit_mock = mock_server.mock(|when, then| {
            when.method(POST).path("/transactions");
            then.status(400).json_body(serde_json::json!({
                "detail": "bad request"
            }));
        });

        let result = client
            .anchor_transfer("transfer-hash", &public_key, secret)
            .await;

        assert!(result.is_err());
        submit_mock.assert();
    }

    // ── misc ─────────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_client_constructor_works() {
        let client = StellarClient::new("https://horizon.stellar.org");
        assert_eq!(client.horizon_url, "https://horizon.stellar.org");
    }
}