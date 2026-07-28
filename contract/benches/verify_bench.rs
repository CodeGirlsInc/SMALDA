//! Criterion benchmark for the cache-hit verification path.
//! Cache-miss latency is documented in `contract/README.md` as the
//! follow-up that requires a Horizon mock (or running against the
//! Stellar testnet directly with the cache cleared between runs).
//!
//! Run:  cd contract && cargo bench --bench verify_bench
//! Compile only:  cargo bench --no-run --bench verify_bench

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::runtime::Runtime;
use tokio::sync::RwLock;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
struct VerifyResponse {
    verified: bool,
    transaction_id: Option<String>,
    timestamp: Option<u64>,
    cached: bool,
}

#[derive(Clone)]
struct InMemoryCache {
    store: Arc<RwLock<HashMap<String, String>>>,
}

impl InMemoryCache {
    fn new() -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn get_raw(&self, key: &str) -> Option<String> {
        let store = self.store.read().await;
        store.get(key).cloned()
    }

    async fn set_raw(&self, key: &str, value: &str) {
        let mut store = self.store.write().await;
        store.insert(key.to_string(), value.to_string());
    }
}

async fn seed(cache: &InMemoryCache, key: &str) {
    let cached = VerifyResponse {
        verified: true,
        transaction_id: Some("bench-tx".to_string()),
        timestamp: Some(1_700_000_000),
        cached: true,
    };
    cache
        .set_raw(key, &serde_json::to_string(&cached).unwrap())
        .await;
}

async fn cache_hit(cache: &InMemoryCache, key: &str) -> VerifyResponse {
    let raw = cache.get_raw(key).await.unwrap();
    serde_json::from_str(&raw).unwrap()
}

fn bench_cache_hit(c: &mut Criterion) {
    let runtime = Runtime::new().unwrap();
    let cache = InMemoryCache::new();
    let key = sample_sha256().to_string();
    runtime.block_on(seed(&cache, &key));

    let mut group = c.benchmark_group("cache_hit");
    group.bench_with_input(BenchmarkId::from_parameter("lookup"), &key, |b, k| {
        b.to_async(&runtime).iter(|| cache_hit(&cache, k));
    });
    group.finish();
}

fn sample_sha256() -> &'static str {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

criterion_group!(verify_benches, bench_cache_hit);
criterion_main!(verify_benches);
