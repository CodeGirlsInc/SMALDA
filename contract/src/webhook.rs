//! Webhook dispatch for verification events (CT-38).
//!
//! `AppConfig` already parses `WEBHOOK_URLS` / `WEBHOOK_SECRET`, but nothing
//! ever POSTed to those URLs. This module adds a tiny fire-and-forget
//! dispatcher: every payload is signed with HMAC-SHA256 (sent in the
//! standard `X-Signature` header) and delivered to each configured URL in a
//! background task so the HTTP response is never blocked by webhook
//! delivery.

use sha2::{Digest, Sha256};
use tracing::warn;

/// Compute an HMAC-SHA256 signature for the raw body.
///
/// Follows the common convention `sha256=<hex digest>` used by GitHub-style
/// webhook signers. When no secret is configured the header is sent as
/// `unsigned` so receivers still know the request came from this service.
pub fn sign_body(body: &str, secret: Option<&str>) -> String {
    let Some(secret) = secret else {
        return "unsigned".to_string();
    };
    format!("sha256={}", hex::encode(hmac_sha256(secret.as_bytes(), body.as_bytes())))
}

/// POST a single signed webhook payload and surface transport/HTTP errors.
pub async fn post_webhook(
    url: &str,
    secret: Option<&str>,
    event: &str,
    payload: &serde_json::Value,
) -> anyhow::Result<()> {
    let body = serde_json::json!({ "event": event, "payload": payload }).to_string();
    let signature = sign_body(&body, secret);

    let resp = reqwest::Client::new()
        .post(url)
        .header("Content-Type", "application/json")
        .header("X-Signature", signature)
        .body(body)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(anyhow::anyhow!(
            "webhook {} responded with {}",
            url,
            resp.status()
        ));
    }
    Ok(())
}

/// Fire-and-forget delivery of an event to every configured URL.
///
/// Each delivery runs in its own background task; failures are logged and
/// never propagated to the caller.
pub fn dispatch(
    urls: &[String],
    secret: Option<&str>,
    event: &str,
    payload: serde_json::Value,
) {
    for url in urls {
        let url = url.clone();
        let secret = secret.map(str::to_string);
        let event = event.to_string();
        let payload = payload.clone();
        tokio::spawn(async move {
            if let Err(e) = post_webhook(&url, secret.as_deref(), &event, &payload).await {
                warn!("webhook dispatch to {} failed: {}", url, e);
            }
        });
    }
}

/// Minimal HMAC-SHA256 using only the `sha2` crate.
fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    const BLOCK_SIZE: usize = 64;

    let mut key = key.to_vec();
    if key.len() > BLOCK_SIZE {
        key = Sha256::digest(&key).to_vec();
    }
    key.resize(BLOCK_SIZE, 0);

    let mut ipad = [0x36u8; BLOCK_SIZE];
    let mut opad = [0x5cu8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        ipad[i] ^= key[i];
        opad[i] ^= key[i];
    }

    let mut inner = Vec::with_capacity(BLOCK_SIZE + message.len());
    inner.extend_from_slice(&ipad);
    inner.extend_from_slice(message);
    let inner_hash = Sha256::digest(&inner);

    let mut outer = Vec::with_capacity(BLOCK_SIZE + 32);
    outer.extend_from_slice(&opad);
    outer.extend_from_slice(&inner_hash);
    Sha256::digest(&outer).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    #[test]
    fn test_sign_body_produces_hex_signature() {
        let sig = sign_body("hello", Some("secret"));
        assert!(sig.starts_with("sha256="));
        // 7 chars prefix + 64 hex chars
        assert_eq!(sig.len(), 71);
    }

    #[test]
    fn test_sign_body_unsigned_without_secret() {
        assert_eq!(sign_body("hello", None), "unsigned");
    }

    #[test]
    fn test_signature_is_deterministic() {
        let a = sign_body("payload", Some("secret"));
        let b = sign_body("payload", Some("secret"));
        assert_eq!(a, b);
    }

    #[tokio::test]
    async fn test_post_webhook_sends_signed_payload() {
        let mock_server = MockServer::start();
        let payload = serde_json::json!({ "document_hash": "abc123" });
        let body = serde_json::json!({ "event": "verify", "payload": payload }).to_string();
        let expected_sig = sign_body(&body, Some("test-secret"));

        let mock = mock_server.mock(|when, then| {
            when.method(POST)
                .path("/hook")
                .header("X-Signature", expected_sig)
                .header("Content-Type", "application/json");
            then.status(200);
        });

        let result = post_webhook(
            &format!("{}/hook", mock_server.url("/")),
            Some("test-secret"),
            "verify",
            &payload,
        )
        .await;

        assert!(result.is_ok());
        mock.assert();
    }

    #[tokio::test]
    async fn test_post_webhook_failure_is_reported() {
        let mock_server = MockServer::start();
        let mock = mock_server.mock(|when, then| {
            when.method(POST).path("/hook");
            then.status(500);
        });

        let result = post_webhook(
            &format!("{}/hook", mock_server.url("/")),
            None,
            "verify",
            &serde_json::json!({}),
        )
        .await;

        assert!(result.is_err());
        mock.assert();
    }
}
