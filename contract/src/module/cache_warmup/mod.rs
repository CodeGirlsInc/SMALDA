use crate::cache::CacheBackend;
use crate::VerifyResponse;
use redis::AsyncCommands;
use serde::Deserialize;
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
struct SubmitRecord {
    tx_hash: String,
}

pub struct CacheWarmupService;

impl CacheWarmupService {
    pub async fn run(cache: &Arc<CacheBackend>, redis_url: &str) {
        let start = Instant::now();

        let client = match redis::Client::open(redis_url) {
            Ok(c) => c,
            Err(e) => {
                warn!("Cache warmup: failed to open Redis client: {}", e);
                return;
            }
        };

        let mut conn = match client.get_async_connection().await {
            Ok(c) => c,
            Err(e) => {
                warn!("Cache warmup: Redis unavailable, skipping warmup: {}", e);
                return;
            }
        };

        // Scan for all submit:* keys
        let keys: Vec<String> = match conn.keys::<_, Vec<String>>("submit:*").await {
            Ok(k) => k,
            Err(e) => {
                warn!("Cache warmup: failed to scan Redis keys: {}", e);
                return;
            }
        };

        if keys.is_empty() {
            info!("Cache warmup: no submit:* keys found, nothing to warm");
            return;
        }

        // Sort by key name (anchored_at is embedded in the record, but we limit by count)
        // Limit to 200 most recent — we sort keys lexicographically as a best-effort ordering
        let mut sorted_keys = keys;
        sorted_keys.sort();
        sorted_keys.truncate(200);

        let mut warmed = 0usize;

        for key in &sorted_keys {
            let hash = key.trim_start_matches("submit:");

            let raw: Option<String> = match conn.get(key).await {
                Ok(v) => v,
                Err(e) => {
                    warn!("Cache warmup: failed to read key {}: {}", key, e);
                    continue;
                }
            };

            let record: SubmitRecord = match raw.and_then(|v| serde_json::from_str(&v).ok()) {
                Some(r) => r,
                None => continue,
            };

            let entry = VerifyResponse {
                verified: true,
                transaction_id: Some(record.tx_hash),
                timestamp: None,
                cached: true,
            };

            if cache.set(hash, &entry, 3600).await.is_ok() {
                warmed += 1;
            }
        }

        info!(
            "Cache warmup: warmed {} entries in {:.2}ms",
            warmed,
            start.elapsed().as_secs_f64() * 1000.0
        );
    }
}
