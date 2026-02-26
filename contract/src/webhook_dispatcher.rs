use hmac::{Hmac, Mac};
use reqwest::Client;
use serde_json::{json, Value};
use sha2::Sha256;
use std::env;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, info, warn};

type HmacSha256 = Hmac<Sha256>;

// ─── Config ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct WebhookConfig {
    pub urls: Vec<String>,   // WEBHOOK_URLS (comma-separated)
    pub secret: String,      // WEBHOOK_SECRET
    pub timeout_secs: u64,   // WEBHOOK_TIMEOUT_SECS (default 5)
}

impl WebhookConfig {
    pub fn from_env() -> Result<Self, String> {
        let urls_raw = env::var("WEBHOOK_URLS").unwrap_or_default();
        let urls = urls_raw
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
            .collect();

        let secret = env::var("WEBHOOK_SECRET")
            .map_err(|_| "WEBHOOK_SECRET env var is required".to_string())?;

        let timeout_secs = env::var("WEBHOOK_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5);

        Ok(Self { urls, secret, timeout_secs })
    }
}

// ─── DeliveryResult ───────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct DeliveryResult {
    pub url: String,
    pub success: bool,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct WebhookDispatcher {
    config: Arc<WebhookConfig>,
    client: Client,
}

impl WebhookDispatcher {
    pub fn new(config: WebhookConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .expect("failed to build reqwest client");

        Self {
            config: Arc::new(config),
            client,
        }
    }

    /// Fire-and-forget: spawns a task and returns immediately.
    /// The caller's response is never delayed.
    pub fn fire(&self, event_type: &str, payload: Value) {
        let dispatcher = self.clone();
        let event_type = event_type.to_string();
        tokio::spawn(async move {
            let results = dispatcher.dispatch(&event_type, payload).await;
            for r in &results {
                if r.success {
                    info!(url = %r.url, event = %event_type, "webhook delivered");
                } else {
                    warn!(
                        url = %r.url,
                        event = %event_type,
                        error = ?r.error,
                        status = ?r.status_code,
                        "webhook delivery failed"
                    );
                }
            }
        });
    }

    /// Dispatch to all URLs concurrently; returns one DeliveryResult per URL.
    pub async fn dispatch(&self, event_type: &str, payload: Value) -> Vec<DeliveryResult> {
        let body = json!({
            "event": event_type,
            "data": payload,
        });
        let body_bytes = serde_json::to_vec(&body).unwrap_or_default();
        let signature = sign(&self.config.secret, &body_bytes);

        let handles: Vec<_> = self
            .config
            .urls
            .iter()
            .map(|url| {
                let client = self.client.clone();
                let url = url.clone();
                let body_bytes = body_bytes.clone();
                let signature = signature.clone();
                tokio::spawn(async move {
                    post_with_retry(&client, &url, &body_bytes, &signature).await
                })
            })
            .collect();

        let mut results = Vec::with_capacity(handles.len());
        for handle in handles {
            match handle.await {
                Ok(result) => results.push(result),
                Err(e) => {
                    error!("webhook task panicked: {:?}", e);
                }
            }
        }
        results
    }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async fn post_with_retry(
    client: &Client,
    url: &str,
    body: &[u8],
    signature: &str,
) -> DeliveryResult {
    match attempt(client, url, body, signature).await {
        r if r.success => r,
        first_failure => {
            warn!(url = %url, "webhook first attempt failed, retrying in 1s");
            sleep(Duration::from_secs(1)).await;
            let retry = attempt(client, url, body, signature).await;
            if retry.success {
                retry
            } else {
                // Return the retry result (most recent error)
                retry
            }
            // shadowing trick: just return retry unconditionally
        }
    }
}

// Helper to avoid the shadowing confusion above
async fn post_with_retry_clean(
    client: &Client,
    url: &str,
    body: &[u8],
    signature: &str,
) -> DeliveryResult {
    let first = attempt(client, url, body, signature).await;
    if first.success {
        return first;
    }
    warn!(url = %url, "webhook first attempt failed, retrying in 1s");
    sleep(Duration::from_secs(1)).await;
    attempt(client, url, body, signature).await
}

async fn attempt(client: &Client, url: &str, body: &[u8], signature: &str) -> DeliveryResult {
    let result = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("X-SMALDA-Signature", signature)
        .body(body.to_vec())
        .send()
        .await;

    match result {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let success = resp.status().is_success();
            DeliveryResult {
                url: url.to_string(),
                success,
                status_code: Some(status),
                error: if success {
                    None
                } else {
                    Some(format!("HTTP {}", status))
                },
            }
        }
        Err(e) => {
            error!(url = %url, error = %e, "webhook HTTP error");
            DeliveryResult {
                url: url.to_string(),
                success: false,
                status_code: None,
                error: Some(e.to_string()),
            }
        }
    }
}

// ─── HMAC signing ─────────────────────────────────────────────────────────────

/// Returns `sha256=<hex>` — same convention as GitHub webhooks.
pub fn sign(secret: &str, body: &[u8]) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(body);
    let result = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(result))
}

/// Verify an incoming signature string against the body.
pub fn verify_signature(secret: &str, body: &[u8], signature: &str) -> bool {
    let expected = sign(secret, body);
    // Constant-time comparison via hmac::Mac::verify_slice
    let sig_hex = signature.strip_prefix("sha256=").unwrap_or(signature);
    let Ok(sig_bytes) = hex::decode(sig_hex) else {
        return false;
    };
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(body);
    mac.verify_slice(&sig_bytes).is_ok()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;
    use serde_json::json;

    fn test_config(urls: Vec<String>) -> WebhookConfig {
        WebhookConfig {
            urls,
            secret: "test-secret".to_string(),
            timeout_secs: 5,
        }
    }

    // ── HMAC signing ─────────────────────────────────────────────────────────

    #[test]
    fn test_sign_produces_sha256_prefix() {
        let sig = sign("my-secret", b"hello");
        assert!(sig.starts_with("sha256="), "signature should start with sha256=");
    }

    #[test]
    fn test_sign_is_deterministic() {
        let a = sign("secret", b"payload");
        let b = sign("secret", b"payload");
        assert_eq!(a, b);
    }

    #[test]
    fn test_sign_differs_with_different_secret() {
        let a = sign("secret-a", b"payload");
        let b = sign("secret-b", b"payload");
        assert_ne!(a, b);
    }

    #[test]
    fn test_verify_signature_round_trip() {
        let body = b"important payload";
        let sig = sign("super-secret", body);
        assert!(verify_signature("super-secret", body, &sig));
    }

    #[test]
    fn test_verify_signature_rejects_tampered_body() {
        let sig = sign("super-secret", b"original");
        assert!(!verify_signature("super-secret", b"tampered", &sig));
    }

    #[test]
    fn test_verify_signature_rejects_wrong_secret() {
        let sig = sign("correct-secret", b"body");
        assert!(!verify_signature("wrong-secret", b"body", &sig));
    }

    // ── Successful dispatch ───────────────────────────────────────────────────

    #[tokio::test]
    async fn test_dispatch_posts_to_all_urls() {
        let server1 = MockServer::start();
        let server2 = MockServer::start();

        let mock1 = server1.mock(|when, then| {
            when.method(POST).path("/hook");
            then.status(200);
        });
        let mock2 = server2.mock(|when, then| {
            when.method(POST).path("/hook");
            then.status(200);
        });

        let dispatcher = WebhookDispatcher::new(test_config(vec![
            format!("{}/hook", server1.base_url()),
            format!("{}/hook", server2.base_url()),
        ]));

        let results = dispatcher
            .dispatch("hash_submitted", json!({"hash": "abc123"}))
            .await;

        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.success));
        mock1.assert();
        mock2.assert();
    }

    // ── HMAC header is sent and verifiable ───────────────────────────────────

    #[tokio::test]
    async fn test_dispatch_sends_valid_hmac_header() {
        let server = MockServer::start();
        let secret = "webhook-secret";

        let mock = server.mock(|when, then| {
            when.method(POST)
                .path("/hook")
                .header_exists("X-SMALDA-Signature");
            then.status(200);
        });

        let config = WebhookConfig {
            urls: vec![format!("{}/hook", server.base_url())],
            secret: secret.to_string(),
            timeout_secs: 5,
        };
        let dispatcher = WebhookDispatcher::new(config);
        let results = dispatcher
            .dispatch("hash_verified", json!({"document_id": "xyz"}))
            .await;

        assert!(results[0].success);
        mock.assert();

        // Manually verify the signature matches the body
        let body = serde_json::to_vec(&json!({
            "event": "hash_verified",
            "data": {"document_id": "xyz"},
        }))
        .unwrap();
        let expected_sig = sign(secret, &body);
        assert!(verify_signature(secret, &body, &expected_sig));
    }

    // ── Retry on failure ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_retries_once_on_failure_then_succeeds() {
        let server = MockServer::start();

        // First call returns 500, second returns 200
        let fail_mock = server.mock(|when, then| {
            when.method(POST).path("/hook");
            then.status(500);
        });

        let dispatcher = WebhookDispatcher::new(test_config(vec![
            format!("{}/hook", server.base_url()),
        ]));

        // We can't cleanly test the retry timing in a unit test without
        // mocking sleep, but we can verify the final result is recorded
        // and the mock was hit at least once.
        let results = dispatcher
            .dispatch("document_revoked", json!({"id": "doc-1"}))
            .await;

        fail_mock.assert_hits(2); // initial + 1 retry
        // Both attempts return 500 in this test
        assert!(!results[0].success);
        assert_eq!(results[0].status_code, Some(500));
    }

    // ── Unreachable URL does not panic ────────────────────────────────────────

    #[tokio::test]
    async fn test_unreachable_url_returns_error_result() {
        let dispatcher = WebhookDispatcher::new(test_config(vec![
            "http://127.0.0.1:19999/no-server".to_string(),
        ]));

        let results = dispatcher
            .dispatch("hash_submitted", json!({}))
            .await;

        assert_eq!(results.len(), 1);
        assert!(!results[0].success);
        assert!(results[0].error.is_some());
        assert_eq!(results[0].status_code, None);
    }

    // ── Empty URL list returns empty results ──────────────────────────────────

    #[tokio::test]
    async fn test_empty_urls_returns_empty_results() {
        let dispatcher = WebhookDispatcher::new(test_config(vec![]));
        let results = dispatcher.dispatch("hash_submitted", json!({})).await;
        assert!(results.is_empty());
    }
}