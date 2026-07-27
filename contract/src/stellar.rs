use anyhow::{anyhow, Result};
use base64::Engine as _;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::time::sleep;
use stellar_base::{
    account::DataValue,
    crypto::KeyPair,
    network::Network,
    operations::Operation,
    transaction::{Transaction, TransactionEnvelope, MIN_BASE_FEE},
    xdr::XDRSerialize,
};
use tracing::info;

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

/// Maximum number of retries when Horizon responds with HTTP 429.
const MAX_RETRIES_ON_429: u32 = 3;
/// Initial back-off duration for 429 responses (doubles each attempt).
const INITIAL_BACKOFF_MS: u64 = 200;

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

    /// Return the base Horizon URL this client targets.
    pub fn horizon_url(&self) -> &str {
        &self.horizon_url
    }

    /// Execute a GET request with automatic 429 back-off.
    ///
    /// On HTTP 429 the call is retried up to [`MAX_RETRIES_ON_429`] times,
    /// honouring a `Retry-After` header when present, otherwise using
    /// exponential back-off starting at [`INITIAL_BACKOFF_MS`] ms.
    async fn get_with_backoff(&self, url: &str) -> anyhow::Result<reqwest::Response> {
        let mut backoff_ms = INITIAL_BACKOFF_MS;
        for attempt in 0..=MAX_RETRIES_ON_429 {
            let resp = self
                .http_client
                .get(url)
                .send()
                .await
                .map_err(|e| anyhow::anyhow!("HTTP GET failed: {}", e))?;

            if resp.status() != reqwest::StatusCode::TOO_MANY_REQUESTS {
                return Ok(resp);
            }

            if attempt == MAX_RETRIES_ON_429 {
                return Ok(resp); // caller will handle the 429
            }

            // Respect Retry-After header if present, otherwise use back-off.
            let wait_ms = resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .map(|secs| secs * 1_000)
                .unwrap_or(backoff_ms);

            tracing::warn!(
                attempt,
                wait_ms,
                "Horizon rate-limited (429), backing off before retry"
            );
            sleep(std::time::Duration::from_millis(wait_ms)).await;
            backoff_ms *= 2;
        }
        unreachable!()
    }

    /// Verifies a document hash against Horizon using the `ManageData` approach.
    ///
    /// Reads `account.data_attr` for key `"doc_" + &hash[..58]`.
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
            .http_client
            .post(&submit_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form_body)
            .send()
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
            .http_client
            .post(&submit_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form_body)
            .send()
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
            .http_client
            .post(&submit_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form_body)
            .send()
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
