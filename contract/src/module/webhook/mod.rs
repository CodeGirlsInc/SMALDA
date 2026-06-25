use reqwest::Client;
use serde_json::json;
use std::env;
use std::time::Duration;
use tracing::{info, warn};

pub struct VerificationWebhookNotifier {
    client: Client,
    url: Option<String>,
}

impl VerificationWebhookNotifier {
    pub fn new() -> Self {
        let url = match env::var("WEBHOOK_URL") {
            Ok(u) if !u.is_empty() => {
                info!("Webhook notifier enabled: {}", u);
                Some(u)
            }
            _ => {
                warn!("WEBHOOK_URL not set — webhook notifier is disabled");
                None
            }
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("failed to build reqwest client");

        Self { client, url }
    }

    pub async fn notify(
        &self,
        event_type: &str,
        document_hash: &str,
        tx_hash: &str,
        timestamp: i64,
    ) {
        let url = match &self.url {
            Some(u) => u.clone(),
            None => return,
        };

        let payload = json!({
            "event_type": event_type,
            "document_hash": document_hash,
            "tx_hash": tx_hash,
            "timestamp": timestamp,
            "service": "smalda-contract"
        });

        if let Err(e) = self.send_with_retry(&url, &payload).await {
            warn!("Webhook delivery failed after retry: {}", e);
        }
    }

    async fn send_with_retry(
        &self,
        url: &str,
        payload: &serde_json::Value,
    ) -> Result<(), String> {
        match self.send(url, payload).await {
            Ok(()) => Ok(()),
            Err(e) => {
                warn!("Webhook delivery failed (attempt 1): {} — retrying in 2s", e);
                tokio::time::sleep(Duration::from_secs(2)).await;
                self.send(url, payload)
                    .await
                    .map_err(|e2| format!("{}", e2))
            }
        }
    }

    async fn send(&self, url: &str, payload: &serde_json::Value) -> Result<(), reqwest::Error> {
        self.client.post(url).json(payload).send().await?;
        Ok(())
    }
}

impl Default for VerificationWebhookNotifier {
    fn default() -> Self {
        Self::new()
    }
}
