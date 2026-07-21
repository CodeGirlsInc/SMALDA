use anyhow::{anyhow, Result};
use base64::Engine as _;
use chrono::Utc;
use serde::{Deserialize, Serialize};
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

pub struct VerificationResult {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
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

    /// Anchor a document hash to Stellar using a `ManageData` operation.
    ///
    /// # Key format
    /// `"doc_" + &hash[..58]`  — matches NestJS `buildDataKey()`.
    ///
    /// # Steps
    /// 1. Fetch the signing account's current sequence number from Horizon.
    /// 2. Build a `Transaction` with a single `ManageData` operation.
    /// 3. Sign with `secret_key`.
    /// 4. Encode as XDR base64 and submit to Horizon.
    /// 5. Return the transaction hash, ledger, and timestamp.
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

        // 1. Fetch account sequence number.
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

        // 2. Build the ManageData operation.
        let data_key = build_data_key(hash);
        let data_value = DataValue::from_slice(hash.as_bytes())
            .map_err(|e| anyhow!("DataValue error: {:?}", e))?;

        let op = Operation::new_manage_data()
            .with_data_name(data_key)
            .with_data_value(Some(data_value))
            .build()
            .map_err(|e| anyhow!("Failed to build ManageData operation: {:?}", e))?;

        // 3. Build and sign the transaction.
        let keypair = KeyPair::from_secret_seed(secret_key)
            .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;

        let network = if self.horizon_url.contains("testnet") {
            Network::new_test()
        } else {
            Network::new_public()
        };

        let mut tx =
            Transaction::builder(keypair.public_key().clone(), sequence, MIN_BASE_FEE)
                .add_operation(op)
                .into_transaction()
                .map_err(|e| anyhow!("Failed to build transaction: {:?}", e))?;

        tx.sign(&keypair, &network)
            .map_err(|e| anyhow!("Failed to sign transaction: {:?}", e))?;

        // 4. Encode to XDR base64.
        let envelope: TransactionEnvelope = tx.into_envelope();
        let xdr_bytes = envelope
            .xdr_bytes()
            .map_err(|e| anyhow!("XDR serialization failed: {:?}", e))?;
        let xdr_b64 = base64::engine::general_purpose::STANDARD.encode(&xdr_bytes);

        // 5. Submit.
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
    /// Key: `"revoked_" + &hash[..56]`  (max 64 bytes).
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

        // Fetch account sequence number.
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

        // Stellar ManageData values are max 64 bytes.
        let raw = revocation_json.as_bytes();
        let value_bytes = &raw[..raw.len().min(64)];
        let data_value = DataValue::from_slice(value_bytes)
            .map_err(|e| anyhow!("DataValue error: {:?}", e))?;

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

        let mut tx =
            Transaction::builder(keypair.public_key().clone(), sequence, MIN_BASE_FEE)
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

/// Build the ManageData key: `"doc_" + &hash[..58]`  (max 62 bytes ≤ 64-byte limit).
pub fn build_data_key(hash: &str) -> String {
    let suffix_len = hash.len().min(58);
    format!("doc_{}", &hash[..suffix_len])
}

/// Build the revocation ManageData key: `"revoked_" + &hash[..56]`  (max 64 bytes).
pub fn build_revocation_key(hash: &str) -> String {
    let suffix_len = hash.len().min(56);
    format!("revoked_{}", &hash[..suffix_len])
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
