//! Webhook dispatch for verification events (CT-38).
//!
//! `AppConfig` already parses `WEBHOOK_URLS` / `WEBHOOK_SECRET`, but nothing
//! ever POSTed to those URLs. This module adds a tiny fire-and-forget
//! dispatcher: every payload is signed with HMAC-SHA256 (sent in the
//! standard `X-Signature` header) and delivered to each configured URL in a
//! background task so the HTTP response is never blocked by webhook
//! delivery.

use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tracing::warn;

/// Hard deadline for a single outbound webhook delivery.
///
/// Without this, a receiver that accepts the connection and then goes silent
/// holds the request open until the OS TCP timeout, which in a default tokio
/// runtime is minutes. `dispatch` runs deliveries concurrently, so a handful of
/// such receivers can saturate the whole worker pool while the service looks
/// healthy from the inside.
///
/// Deliberately generous: a webhook receiver is another network hop and a cold
/// database behind it, so this should be well above a normal slow delivery.
/// The point is to fail a dead receiver rather than wait on it indefinitely.
pub const WEBHOOK_TIMEOUT: Duration = Duration::from_secs(10);

/// Shared HTTP client for all webhook deliveries.
///
/// Built once rather than per call: `reqwest::Client` owns a connection pool
/// and spawning one per delivery discards that pool and opens a fresh TLS
/// handshake to every receiver every time.
static WEBHOOK_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(WEBHOOK_TIMEOUT)
        .pool_max_idle_per_host(4)
        .build()
        // Only fails on an invalid TLS backend or a bad proxy setting, neither
        // of which is configurable here, so a panic at first use is the honest
        // outcome rather than a silently client-less dispatcher.
        .expect("failed to build webhook HTTP client")
});

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
///
/// Bounded by [`WEBHOOK_TIMEOUT`]; a receiver that never responds fails here
/// rather than holding the task open.
pub async fn post_webhook(
    url: &str,
    secret: Option<&str>,
    event: &str,
    payload: &serde_json::Value,
) -> anyhow::Result<()> {
    let body = serde_json::json!({ "event": event, "payload": payload }).to_string();
    let signature = sign_body(&body, secret);

    let resp = WEBHOOK_CLIENT
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

    #[test]
    fn the_outbound_client_has_a_deadline() {
        // The regression guard for #1364. A client with no timeout leaves a
        // silent receiver holding the task until the OS gives up, which in a
        // default runtime is minutes rather than the 10s above.
        assert!(
            WEBHOOK_TIMEOUT > Duration::ZERO,
            "an unbounded client is the bug this test exists to catch"
        );
        assert_eq!(
            WEBHOOK_CLIENT.get_timeout(),
            Some(WEBHOOK_TIMEOUT),
            "the shared client must actually carry the deadline, not just declare it"
        );
    }

    #[tokio::test]
    async fn test_post_webhook_times_out_on_a_silent_receiver() {
        // httpmock can delay a response; a delay longer than the timeout must
        // surface as an error instead of hanging.
        let mock_server = MockServer::start_async().await;
        let _mock = mock_server
            .mock_async(|when, then| {
                when.method(POST).path("/hook");
                then.status(200).delay(std::time::Duration::from_secs(30));
            })
            .await;

        let result = tokio::time::timeout(
            WEBHOOK_TIMEOUT + Duration::from_secs(2),
            post_webhook(
                &format!("{}/hook", mock_server.url("/")),
                None,
                "verify",
                &serde_json::json!({}),
            ),
        )
        .await
        .expect("post_webhook must give up rather than hang past its deadline")
        .expect_err("a slow receiver should produce an error, not a success");

        // reqwest surfaces the deadline as a timeout / request error.
        assert!(
            format!("{result}").to_lowercase().contains("timeout")
                || format!("{result}").to_lowercase().contains("timed out"),
            "expected a timeout error, got: {result}"
        );
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
