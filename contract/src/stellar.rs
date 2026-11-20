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
    /// Per-operation fee in stroops attached to every transaction this client
    /// submits.
    ///
    /// Defaults to [`MIN_BASE_FEE`] but is configurable, because the network
    /// base fee is not a constant: during a fee spike a transaction pinned at
    /// the historical minimum is rejected with `insufficient fee` and the
    /// anchoring fails outright. Raising this lets an operator boost submissions
    /// without a redeploy.
    ///
    /// This is *not* a Stellar fee-bump transaction — a fee bump wraps an
    /// already-signed envelope and is the protocol's answer to a raised fee.
    /// Building one needs an SDK that exposes `FeeBumpTransaction`, which the
    /// pinned `stellar-base 0.5` does not; see #1368 for the dependency mess
    /// that pin sits in. Until that is sorted, the configurable base fee is the
    /// available lever, and it covers the same fee-spike failure.
    base_fee: u32,
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
    /// Whether a `revoked_<hash>` ManageData entry exists for this document.
    ///
    /// Without this, "never submitted" and "submitted then revoked" both came
    /// back as `anchored: false` with an otherwise identical record, so a caller
    /// could not tell a document that does not exist from one that was
    /// deliberately withdrawn. Those are different states with different
    /// remedies, and collapsing them is what #1378 is about.
    pub revoked: bool,
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
    /// Number of subentries (data entries, trustlines, offers, signers).
    #[serde(default)]
    subentry_count: u32,
    #[serde(default)]
    balances: Vec<HorizonBalance>,
}

#[derive(Debug, Deserialize)]
struct HorizonBalance {
    asset_type: String,
    balance: String,
}

/// Stellar's hard cap on subentries per account.
pub const MAX_ACCOUNT_SUBENTRIES: u32 = 1000;

/// Headroom of the anchor account against Stellar's subentry cap and reserve.
///
/// Every anchor, transfer and revocation is a ManageData entry (one subentry
/// each), so this is the service's capacity counter. See
/// `contract/docs/anchoring-capacity.md`.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct AccountCapacity {
    pub subentry_count: u32,
    pub subentry_limit: u32,
    /// Native balance in XLM.
    pub balance_xlm: f64,
    /// Minimum balance in XLM: (2 + subentries) * 0.5 (base reserve).
    pub min_balance_xlm: f64,
    /// `balance_xlm - min_balance_xlm`; negative means submits will fail.
    pub reserve_headroom_xlm: f64,
    /// Percentage of the subentry cap in use.
    pub subentry_usage_percent: f64,
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
    #[serde(default)]
    _links: Option<OperationsLinks>,
}

#[derive(Debug, Deserialize)]
struct OperationsLinks {
    next: Option<OperationsLink>,
}

#[derive(Debug, Deserialize)]
struct OperationsLink {
    href: String,
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

/// Holds the most recent retryable Horizon response.
///
/// The retry helper consumes responses as it classifies them, so without a slot
/// to stash the last one in, a retry-exhausted 429 would arrive at the caller as
/// an opaque error string and Horizon's actual explanation would be lost. The
/// guard is only ever taken inside a single statement and never held across an
/// `await`, so the futures stay `Send`.
#[derive(Clone, Default)]
struct LastResponse(Arc<std::sync::Mutex<Option<reqwest::Response>>>);

impl LastResponse {
    fn store(&self, resp: reqwest::Response) {
        if let Ok(mut slot) = self.0.lock() {
            *slot = Some(resp);
        }
    }

    fn take(&self) -> Option<reqwest::Response> {
        self.0.lock().ok().and_then(|mut slot| slot.take())
    }
}

/// Whether a Horizon response is worth retrying.
///
/// `429` is the case the retry module has always advertised but nothing ever
/// exercised: a rate-limited request is transient by definition, and Horizon
/// expects the caller to back off and try again. 5xx is included for the same
/// reason.
///
/// Every other status is returned to the caller untouched, including 4xx. Those
/// are terminal by nature — a bad hash or an unknown account will not fix
/// itself — and the callers already format Horizon's error body into a useful
/// message, so turning them into retry errors would only add latency and change
/// diagnostics.
fn classify_response(
    resp: reqwest::Response,
    url: &str,
    last_response: &LastResponse,
) -> Result<reqwest::Response, RetryableError> {
    let status = resp.status();

    if status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
        // Surface whatever Horizon asked for, so the retry reason says why we
        // are waiting rather than just that we are.
        let retry_after = resp
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|v| v.to_str().ok())
            .map(|v| format!(" (Retry-After: {v})"))
            .unwrap_or_default();

        last_response.store(resp);

        return Err(RetryableError::Retryable(format!(
            "Horizon {status} from {url}{retry_after}, retrying with backoff"
        )));
    }

    Ok(resp)
}

/// Turn a retry outcome into a response or an error.
///
/// Prefers the stashed response over the generic error: Horizon's own error
/// body is more useful to a caller than "retry budget exhausted".
fn finish(
    outcome: Result<reqwest::Response, RetryableError>,
    last_response: LastResponse,
    url: &str,
) -> anyhow::Result<reqwest::Response> {
    match outcome {
        Ok(resp) => Ok(resp),
        Err(err) => match last_response.take() {
            Some(resp) => Ok(resp),
            None => Err(anyhow::anyhow!("horizon request to {url}: {}", err.into_string())),
        },
    }
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
            base_fee: MIN_BASE_FEE,
        }
    }

    /// Build a client that submits transactions at `base_fee` stroops.
    ///
    /// Zero falls back to [`MIN_BASE_FEE`] rather than being honoured: every
    /// Stellar network rejects a zero fee, so accepting it would turn a
    /// configuration mistake into a submission failure at runtime instead of at
    /// startup.
    pub fn with_base_fee(mut self, base_fee: u32) -> Self {
        self.base_fee = if base_fee == 0 { MIN_BASE_FEE } else { base_fee };
        self
    }

    /// The per-operation fee in stroops this client attaches to submissions.
    pub fn base_fee(&self) -> u32 {
        self.base_fee
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

    /// Whether the configured Horizon URL is the testnet one.
    ///
    /// Split out from [`Self::horizon_network`] so the decision is testable
    /// without depending on the `Network` type's accessor methods, which differ
    /// between `stellar-base` releases.
    #[cfg(test)]
    fn horizon_is_testnet(&self) -> bool {
        self.horizon_url.contains("testnet")
    }

    /// The Stellar network used to sign transactions for this client.
    ///
    /// One place for all three transaction builders. `STELLAR_NETWORK` wins
    /// over guessing from the URL, so a self-hosted Horizon signs with the
    /// right passphrase (issue #1439); see [`signing_network`].
    fn horizon_network(&self) -> Network {
        signing_network(&self.horizon_url)
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
            base_fee: MIN_BASE_FEE,
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
    /// Transient responses (429, 5xx) are retried with the policy's exponential
    /// backoff and jitter. When the budget is exhausted the **last response is
    /// returned rather than an error**, because Horizon's own error body is a far
    /// better diagnostic than a generic "retry budget exhausted" string and every
    /// caller already knows how to format one.
    ///
    /// Returns `Err(anyhow::Error)` only when the breaker is open up-front, or
    /// the retry budget is exhausted on purely transport-level failures where
    /// there is no response to hand back.
    async fn get_with_backoff(&self, url: &str) -> anyhow::Result<reqwest::Response> {
        let breaker = self.circuit_breaker.clone();
        let policy = self.retry_policy.clone();
        let client = self.http_client.clone();
        let url_owned = url.to_string();
        let last_response = LastResponse::default();

        let outcome = with_retry_and_cb(&breaker, &policy, {
            let last_response = last_response.clone();
            move || {
                let client = client.clone();
                let url_owned = url_owned.clone();
                let last_response = last_response.clone();
                async move {
                    match client.get(&url_owned).send().await {
                        Ok(resp) => classify_response(resp, &url_owned, &last_response),
                        Err(e) => Err(RetryableError::Retryable(format!(
                            "HTTP GET {url_owned} failed: {e}"
                        ))),
                    }
                }
            }
        })
        .await;

        finish(outcome, last_response, url)
    }

    /// POST a form-urlencoded envelope to Horizon, wrapped in the retry
    /// policy and circuit breaker.
    ///
    /// Callers must build the envelope / form_body OUTSIDE this helper:
    /// the same bytes are re-sent on every retry, but re-signing and
    /// re-fetching the source sequence must happen once at the caller to
    /// keep POSTs idempotent under retry.
    ///
    /// Retries 429 and 5xx exactly as [`Self::get_with_backoff`] does.
    async fn horizon_post(&self, url: &str, body: String) -> anyhow::Result<reqwest::Response> {
        let breaker = self.circuit_breaker.clone();
        let policy = self.retry_policy.clone();
        let client = self.http_client.clone();
        let url_owned = url.to_string();
        let last_response = LastResponse::default();

        let outcome = with_retry_and_cb(&breaker, &policy, {
            let last_response = last_response.clone();
            move || {
                let client = client.clone();
                let url_owned = url_owned.clone();
                let body = body.clone();
                let last_response = last_response.clone();
                async move {
                    match client
                        .post(&url_owned)
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .body(body)
                        .send()
                        .await
                    {
                        Ok(resp) => classify_response(resp, &url_owned, &last_response),
                        Err(e) => Err(RetryableError::Retryable(format!(
                            "HTTP POST {url_owned} failed: {e}"
                        ))),
                    }
                }
            }
        })
        .await;

        finish(outcome, last_response, url)
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
        let revocation_key = build_revocation_key(hash);

        // A revocation entry takes precedence over the anchor entry. Checking the
        // anchor first would report a revoked document as merely unanchored,
        // which is the wrong answer to the wrong question.
        if account.data.contains_key(&revocation_key) {
            return Ok(VerificationRecord {
                hash: hash.to_string(),
                anchored: false,
                revoked: true,
                data_key,
                transaction_id: None,
                timestamp: None,
                raw_value_base64: None,
                decoded_value: None,
            });
        }

        if let Some(b64_val) = account.data.get(&data_key) {
            let decoded_bytes = base64::engine::general_purpose::STANDARD
                .decode(b64_val)
                .unwrap_or_else(|_| b64_val.as_bytes().to_vec());
            let decoded_str = String::from_utf8_lossy(&decoded_bytes).to_string();

            Ok(VerificationRecord {
                hash: hash.to_string(),
                anchored: true,
                revoked: false,
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
                revoked: false,
                data_key,
                transaction_id: None,
                timestamp: None,
                raw_value_base64: None,
                decoded_value: None,
            })
        }
    }

    /// Subentry count and reserve headroom of the anchor account (issue #1666).
    pub async fn account_capacity(&self, anchor_account_id: &str) -> Result<AccountCapacity> {
        let url = format!("{}/accounts/{}", self.horizon_url, anchor_account_id);
        let resp = self
            .get_with_backoff(&url)
            .await
            .map_err(|e| anyhow!("Failed to fetch account info from Horizon: {}", e))?;
        if !resp.status().is_success() {
            return Err(anyhow!(
                "Horizon account fetch failed with status {}",
                resp.status().as_u16()
            ));
        }
        let account: HorizonAccount = resp.json().await?;
        let balance_xlm = account
            .balances
            .iter()
            .find(|b| b.asset_type == "native")
            .and_then(|b| b.balance.parse::<f64>().ok())
            .unwrap_or(0.0);
        let min_balance_xlm = (2.0 + account.subentry_count as f64) * 0.5;
        Ok(AccountCapacity {
            subentry_count: account.subentry_count,
            subentry_limit: MAX_ACCOUNT_SUBENTRIES,
            balance_xlm,
            min_balance_xlm,
            reserve_headroom_xlm: balance_xlm - min_balance_xlm,
            subentry_usage_percent: account.subentry_count as f64 * 100.0
                / MAX_ACCOUNT_SUBENTRIES as f64,
        })
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
        let revocation_key = build_revocation_key(hash);

        // Every document shares one anchor account, so its operation stream holds
        // every submit, transfer and revoke for every document. Follow Horizon's
        // `_links.next` page by page (issue #1667) instead of reading only the
        // newest 200 operations, stopping once this document's own anchor entry
        // is reached (the oldest entry it can have, as pages are newest first),
        // when a page is empty, or at a hard page cap.
        const PAGE_LIMIT: u32 = 200;
        const MAX_PAGES: usize = 50;
        let transfer_prefix = transfer_key_prefix(hash);

        let mut url = format!(
            "{}/accounts/{}/operations?order=desc&limit={}",
            self.horizon_url, anchor_account_id, PAGE_LIMIT
        );
        let mut history = Vec::new();

        'pages: for _ in 0..MAX_PAGES {
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
            let next = ops._links.and_then(|l| l.next).map(|l| l.href);
            let page_empty = ops._embedded.records.is_empty();

            for op in ops._embedded.records {
                if op.op_type != "manage_data" {
                    continue;
                }
                let Some(ref name) = op.name else { continue };
                let is_anchor = name == &data_key;
                if is_anchor || name.starts_with(&transfer_prefix) || name == &revocation_key {
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
                    if is_anchor {
                        break 'pages;
                    }
                }
            }

            match next {
                Some(href) if !page_empty => url = href,
                _ => break,
            }
        }

        Ok(history)
    }

    /// Anchor a transfer record on Stellar using a `ManageData` operation.
    #[tracing::instrument(
        name = "stellar.anchor_transfer",
        skip(self, document_hash, transfer_hash, secret_key),
        fields(hash_prefix = %hash_prefix(transfer_hash), public_key = %public_key)
    )]
    pub async fn anchor_transfer(
        &self,
        document_hash: &str,
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

        // One data entry per transfer, namespaced by document, so a second
        // transfer never replaces the first and history can be listed per
        // document (issue #1668).
        let transfer_key = build_transfer_entry_key(document_hash, transfer_hash);
        let data_value = DataValue::from_slice(transfer_hash.as_bytes())
            .map_err(|e| anyhow!("DataValue error: {:?}", e))?;

        let op = Operation::new_manage_data()
            .with_data_name(transfer_key)
            .with_data_value(Some(data_value))
            .build()
            .map_err(|e| anyhow!("Failed to build ManageData operation: {:?}", e))?;

        let keypair = KeyPair::from_secret_seed(secret_key)
            .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;

        let network = self.horizon_network();

        let mut tx = Transaction::builder(keypair.public_key().clone(), sequence, self.base_fee)
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

        let network = self.horizon_network();

        let mut tx = Transaction::builder(keypair.public_key().clone(), sequence, self.base_fee)
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
    /// Value: a compact value from [`build_revocation_value`] (at most 64 bytes;
    /// longer values are rejected, never truncated).
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

        // Never truncate: cutting a JSON value at 64 bytes leaves invalid JSON
        // (and can split a UTF-8 character) on-chain (issue #1665).
        let value_bytes = revocation_json.as_bytes();
        if value_bytes.len() > MAX_DATA_VALUE_BYTES {
            return Err(anyhow!(
                "revocation value is {} bytes; ManageData values are limited to {}",
                value_bytes.len(),
                MAX_DATA_VALUE_BYTES
            ));
        }
        let data_value =
            DataValue::from_slice(value_bytes).map_err(|e| anyhow!("DataValue error: {:?}", e))?;

        let op = Operation::new_manage_data()
            .with_data_name(revocation_key)
            .with_data_value(Some(data_value))
            .build()
            .map_err(|e| anyhow!("Failed to build ManageData operation: {:?}", e))?;

        let keypair = KeyPair::from_secret_seed(secret_key)
            .map_err(|e| anyhow!("Invalid secret key: {:?}", e))?;

        let network = self.horizon_network();

        let mut tx = Transaction::builder(keypair.public_key().clone(), sequence, self.base_fee)
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

/// Signing network: `STELLAR_NETWORK` wins over guessing from the URL (issue #1439).
fn signing_network(horizon_url: &str) -> Network {
    match std::env::var("STELLAR_NETWORK").map(|s| s.to_lowercase()).as_deref() {
        Ok("mainnet") => Network::new_public(),
        Ok("testnet") => Network::new_test(),
        _ if horizon_url.contains("testnet") => Network::new_test(),
        _ => Network::new_public(),
    }
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

/// Prefix shared by every transfer entry of one document: `"trf_" + &doc[..24] + "_"`.
pub fn transfer_key_prefix(document_hash: &str) -> String {
    let n = document_hash.len().min(24);
    format!("trf_{}_", &document_hash[..n])
}

/// Per-transfer ManageData key: the document prefix plus the first 29 bytes of
/// the transfer hash (at most 58 bytes in total, under Stellar's 64).
pub fn build_transfer_entry_key(document_hash: &str, transfer_hash: &str) -> String {
    let n = transfer_hash.len().min(29);
    format!("{}{}", transfer_key_prefix(document_hash), &transfer_hash[..n])
}

/// Largest value Stellar allows in a ManageData entry.
pub const MAX_DATA_VALUE_BYTES: usize = 64;

/// Compact, fixed-size on-chain revocation value: `"<unix_ts>|<32 hex>"`, where
/// the hex is the first 128 bits of SHA-256 over the canonical revocation JSON
/// (which keeps the reason and `revokedBy`; the full record lives in the audit
/// log and webhook). Always well-formed UTF-8 and well under 64 bytes.
pub fn build_revocation_value(revoked_at: i64, revocation_json: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = hex::encode(Sha256::digest(revocation_json.as_bytes()));
    format!("{}|{}", revoked_at, &digest[..32])
}

/// Inverse of [`build_revocation_value`]: `(unix_ts, digest_hex)`.
pub fn parse_revocation_value(value: &str) -> Option<(i64, String)> {
    let (ts, digest) = value.split_once('|')?;
    if digest.len() != 32 || !digest.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    Some((ts.parse().ok()?, digest.to_string()))
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
            .anchor_transfer("doc-hash", "transfer-hash", &public_key, secret)
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
            .anchor_transfer("doc-hash", "transfer-hash", &public_key, secret)
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

    // ── Status classification for retry (#1361) ──────────────────

    fn status_of(code: u16) -> reqwest::StatusCode {
        reqwest::StatusCode::from_u16(code).unwrap()
    }

    #[test]
    fn a_429_is_classified_as_retryable() {
        // The case retry.rs has always documented and nothing ever exercised:
        // Horizon expects a rate-limited caller to back off and retry, but the
        // response was previously handed straight to the caller as a failure.
        let last = LastResponse::default();
        let resp = reqwest::Response::builder()
            .status(status_of(429))
            .body(Vec::new())
            .unwrap();

        let err = classify_response(resp, "https://horizon.test/accounts/x", &last)
            .expect_err("429 must be retryable");
        let reason = err.into_string();

        assert!(reason.contains("429"), "reason should name the status: {reason}");
    }

    #[test]
    fn a_429_retry_reason_includes_the_retry_after_header_when_present() {
        let last = LastResponse::default();
        let resp = reqwest::Response::builder()
            .status(status_of(429))
            .header("Retry-After", "7")
            .body(Vec::new())
            .unwrap();

        let err = classify_response(resp, "https://horizon.test/x", &last).unwrap_err();
        assert!(err.into_string().contains("Retry-After: 7"));
    }

    #[test]
    fn a_429_without_a_retry_after_header_is_still_retryable() {
        let last = LastResponse::default();
        let resp = reqwest::Response::builder()
            .status(status_of(429))
            .body(Vec::new())
            .unwrap();

        assert!(classify_response(resp, "https://horizon.test/x", &last).is_err());
    }

    #[test]
    fn server_errors_are_classified_as_retryable() {
        for code in [500u16, 502, 503, 504] {
            let last = LastResponse::default();
            let resp = reqwest::Response::builder()
                .status(status_of(code))
                .body(Vec::new())
                .unwrap();

            if classify_response(resp, "https://horizon.test/x", &last).is_err() {
                continue;
            }
            panic!("{code} should be retried, not returned to the caller");
        }
    }

    #[test]
    fn client_errors_are_left_to_the_caller() {
        // 4xx is terminal: a bad hash or unknown account will not fix itself,
        // and callers already format Horizon's body into a good message.
        for code in [400u16, 401, 403, 404, 422] {
            let last = LastResponse::default();
            let resp = reqwest::Response::builder()
                .status(status_of(code))
                .body(Vec::new())
                .unwrap();

            let returned = classify_response(resp, "https://horizon.test/x", &last)
                .unwrap_or_else(|_| panic!("{code} must not be retried"));
            assert_eq!(returned.status(), status_of(code));
        }
    }

    #[test]
    fn successes_are_returned_untouched() {
        for code in [200u16, 201, 204] {
            let last = LastResponse::default();
            let resp = reqwest::Response::builder()
                .status(status_of(code))
                .body(Vec::new())
                .unwrap();

            let returned = classify_response(resp, "https://horizon.test/x", &last).unwrap();
            assert_eq!(returned.status(), status_of(code));
        }
    }

    #[test]
    fn a_retryable_response_is_stashed_for_handover() {
        // Without this, a retry-exhausted 429 reaches the caller as an opaque
        // string and Horizon's actual error body is lost.
        let last = LastResponse::default();
        let resp = reqwest::Response::builder()
            .status(status_of(429))
            .body(Vec::new())
            .unwrap();

        classify_response(resp, "https://horizon.test/x", &last).unwrap_err();

        let stashed = last.take().expect("a retryable response must be stashed");
        assert_eq!(stashed.status(), status_of(429));
    }

    #[test]
    fn taking_the_stashed_response_consumes_it() {
        let last = LastResponse::default();
        assert!(
            last.take().is_none(),
            "an empty slot must not hand back a response"
        );

        let resp = reqwest::Response::builder()
            .status(status_of(503))
            .body(Vec::new())
            .unwrap();
        last.store(resp);

        assert!(last.take().is_some());
        assert!(
            last.take().is_none(),
            "the slot should be empty again after a take"
        );
    }

    #[tokio::test]
    async fn a_retry_exhausted_429_is_handed_back_as_a_response_not_an_error() {
        // The behaviour that keeps callers working: Horizon's own error body is
        // more useful to a caller than "retry budget exhausted".
        let last = LastResponse::default();
        let resp = reqwest::Response::builder()
            .status(status_of(429))
            .body("rate limited".to_string())
            .unwrap();
        last.store(resp);

        let outcome: Result<reqwest::Response, RetryableError> =
            Err(RetryableError::Retryable("budget exhausted".into()));
        let returned = finish(outcome, last.clone(), "https://horizon.test/x").unwrap();

        assert_eq!(returned.status(), status_of(429));
        assert!(
            last.take().is_none(),
            "the slot should be consumed exactly once"
        );
    }

    #[tokio::test]
    async fn a_transport_failure_with_no_response_is_still_an_error() {
        // Nothing to hand back, so this must not pretend to be a response.
        let last = LastResponse::default();
        let outcome: Result<reqwest::Response, RetryableError> =
            Err(RetryableError::Retryable("connection refused".into()));

        let err = finish(outcome, last, "https://horizon.test/x")
            .expect_err("with no stashed response this must be an error");
        assert!(format!("{err}").contains("horizon.test"));
    }

    // ── Horizon URL / network (#1362) ───────────────────────────

    #[test]
    fn a_custom_horizon_url_is_honoured() {
        // The endpoint is configuration: STELLAR_HORIZON_URL is read in
        // config.rs and validated against STELLAR_NETWORK at startup, so
        // pointing at another instance needs no code change.
        let client = StellarClient::new("http://localhost:8000");
        assert_eq!(client.horizon_url, "http://localhost:8000");
    }

    #[test]
    fn the_network_passphrase_follows_the_configured_url() {
        // Consolidated from three duplicated inline blocks.
        assert!(StellarClient::new("https://horizon-testnet.stellar.org").horizon_is_testnet());
        assert!(!StellarClient::new("https://horizon.stellar.org").horizon_is_testnet());

        // Known limitation, tracked by #1439: anything that is not testnet is
        // treated as public, including a self-hosted Horizon. Pinned so the
        // behaviour cannot change unnoticed before that fix lands.
        assert!(!StellarClient::new("http://localhost:8000").horizon_is_testnet());
    }

    // ── revocation value, capacity, history, transfer keys (#1665-#1668) ───────

    #[test]
    fn revocation_value_is_compact_and_round_trips() {
        let json = serde_json::json!({
            "revokedAt": "2026-11-18T12:34:56.789012345+00:00",
            "reason": "é".repeat(200),
            "revokedBy": "someone@example.com",
        })
        .to_string();
        let value = build_revocation_value(1_763_469_296, &json);
        assert!(value.len() <= MAX_DATA_VALUE_BYTES);
        assert!(std::str::from_utf8(value.as_bytes()).is_ok());
        let (ts, digest) = parse_revocation_value(&value).expect("well-formed");
        assert_eq!(ts, 1_763_469_296);
        assert_eq!(digest.len(), 32);
        // Different records give different digests.
        assert_ne!(value, build_revocation_value(1_763_469_296, "{}"));
    }

    #[test]
    fn parse_revocation_value_rejects_garbage() {
        assert!(parse_revocation_value("not a value").is_none());
        assert!(parse_revocation_value("12|zz").is_none());
    }

    #[test]
    fn transfer_keys_are_unique_per_transfer_and_within_the_limit() {
        let doc = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let t1 = "a".repeat(64);
        let t2 = "b".repeat(64);
        let k1 = build_transfer_entry_key(doc, &t1);
        let k2 = build_transfer_entry_key(doc, &t2);
        assert_ne!(k1, k2);
        assert!(k1.len() <= 64 && k2.len() <= 64);
        assert!(k1.starts_with(&transfer_key_prefix(doc)));
    }

    #[tokio::test]
    async fn test_anchor_revocation_rejects_an_oversized_value_instead_of_truncating() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(200)
                .json_body(serde_json::json!({ "sequence": "1", "data": {} }));
        });
        let secret = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        let result = client
            .anchor_revocation("abc", &"x".repeat(65), TEST_ACCOUNT, secret)
            .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("limited to 64"));
    }

    #[tokio::test]
    async fn test_account_capacity_reports_subentries_and_headroom() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        mock_server.mock(|when, then| {
            when.method(GET).path(format!("/accounts/{}", TEST_ACCOUNT));
            then.status(200).json_body(serde_json::json!({
                "sequence": "1",
                "subentry_count": 800,
                "data": {},
                "balances": [{ "asset_type": "native", "balance": "500.0000000" }]
            }));
        });
        let cap = client.account_capacity(TEST_ACCOUNT).await.unwrap();
        assert_eq!(cap.subentry_count, 800);
        assert_eq!(cap.subentry_usage_percent, 80.0);
        assert_eq!(cap.min_balance_xlm, 401.0);
        assert_eq!(cap.reserve_headroom_xlm, 99.0);
    }

    fn manage_data_op(id: &str, name: &str, value_b64: &str) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "transaction_hash": format!("tx-{id}"),
            "created_at": "2026-01-01T00:00:00Z",
            "type": "manage_data",
            "name": name,
            "value": value_b64,
        })
    }

    #[tokio::test]
    async fn test_get_hash_history_follows_pagination_past_200_unrelated_operations() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let doc = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let b64 = |s: &str| base64::engine::general_purpose::STANDARD.encode(s.as_bytes());

        let unrelated: Vec<_> = (0..200)
            .map(|i| manage_data_op(&format!("u{i}"), &format!("doc_other{i}"), &b64("x")))
            .collect();
        let ops_path = format!("/accounts/{}/operations", TEST_ACCOUNT);

        mock_server.mock(|when, then| {
            when.method(GET).path(ops_path.clone()).query_param("order", "desc");
            then.status(200).json_body(serde_json::json!({
                "_embedded": { "records": unrelated },
                "_links": { "next": { "href": mock_server.url("/page2") } }
            }));
        });
        let transfer_name = build_transfer_entry_key(doc, &"c".repeat(64));
        let anchor_name = build_data_key(doc);
        mock_server.mock(|when, then| {
            when.method(GET).path("/page2");
            then.status(200).json_body(serde_json::json!({
                "_embedded": { "records": [
                    manage_data_op("t1", &transfer_name, &b64(&"c".repeat(64))),
                    manage_data_op("a1", &anchor_name, &b64(doc)),
                ] },
                "_links": { "next": { "href": mock_server.url("/page3") } }
            }));
        });

        let history = client.get_hash_history(doc, TEST_ACCOUNT).await.unwrap();
        let names: Vec<_> = history.iter().map(|h| h.data_name.clone()).collect();
        assert_eq!(names, vec![transfer_name, anchor_name]);
    }

    #[tokio::test]
    async fn test_get_hash_history_returns_every_transfer_of_one_document() {
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let doc = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let b64 = |s: &str| base64::engine::general_purpose::STANDARD.encode(s.as_bytes());
        let (t1, t2) = ("1".repeat(64), "2".repeat(64));

        mock_server.mock(|when, then| {
            when.method(GET)
                .path(format!("/accounts/{}/operations", TEST_ACCOUNT));
            then.status(200).json_body(serde_json::json!({
                "_embedded": { "records": [
                    manage_data_op("2", &build_transfer_entry_key(doc, &t2), &b64(&t2)),
                    manage_data_op("1", &build_transfer_entry_key(doc, &t1), &b64(&t1)),
                ] }
            }));
        });

        let history = client.get_hash_history(doc, TEST_ACCOUNT).await.unwrap();
        assert_eq!(history.len(), 2);
    }
}
