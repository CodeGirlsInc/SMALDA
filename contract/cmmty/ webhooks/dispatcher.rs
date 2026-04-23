use serde::Serialize;
use tokio::time::{sleep, Duration};
use reqwest::Client;

use super::signer::sign;

#[derive(Serialize)]
pub struct Payload {
    pub event: String,
    pub hash: String,
    pub txId: String,
    pub timestamp: i64,
}

pub async fn dispatch(
    urls: Vec<String>,
    secret: String,
    payload: Payload,
) {
    let client = Client::new();
    let body = serde_json::to_string(&payload).unwrap();
    let sig = sign(&secret, &body);

    for url in urls {
        let mut attempt = 0;

        loop {
            attempt += 1;

            let res = client
                .post(&url)
                .header("X-Signature", &sig)
                .body(body.clone())
                .send()
                .await;

            if res.is_ok() || attempt >= 3 {
                break;
            }

            sleep(Duration::from_secs(2_u64.pow(attempt))).await;
        }
    }
}