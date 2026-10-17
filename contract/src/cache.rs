use anyhow::Result;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::warn;

use crate::retry::{with_retry_and_cb, CircuitBreaker, RetryPolicy, RetryableError};

/// How long to keep retrying the initial Redis connection at startup.
///
/// `ConnectionManager` reconnects on its own once established, but if Redis is
/// momentarily unavailable when the process boots — a rolling restart, a
/// failover, a container starting before its dependency — `new` fails and the
/// service refuses to start at all. Retrying here turns that into a slow start.
const STARTUP_CONNECT_ATTEMPTS: u32 = 5;
const STARTUP_CONNECT_BACKOFF: Duration = Duration::from_millis(500);

/// How long a single cache operation may be retried for.
///
/// Deliberately short. A cache miss is cheap to absorb — the caller falls back
/// to Horizon — so spending seconds retrying a dead Redis would add latency to
/// every request for a benefit the caller does not need.
const OP_RETRY_ATTEMPTS: u32 = 2;
const OP_RETRY_BACKOFF: Duration = Duration::from_millis(50);

#[derive(Clone)]
pub enum CacheBackend {
    Redis(RedisCache),
    InMemory(InMemoryCache),
}

impl CacheBackend {
    #[tracing::instrument(name = "cache.check_connection", skip(self))]
    pub async fn check_connection(&self) -> bool {
        match self {
            Self::Redis(c) => c.check_connection().await,
            Self::InMemory(c) => c.check_connection().await,
        }
    }

    #[tracing::instrument(name = "cache.close", skip(self))]
    pub async fn close(&self) {
        match self {
            Self::Redis(c) => c.close().await,
            Self::InMemory(c) => c.close().await,
        }
    }

    #[tracing::instrument(name = "cache.get_raw", skip(self), fields(key = %key))]
    pub async fn get_raw(&self, key: &str) -> Result<Option<String>> {
        match self {
            Self::Redis(c) => c.get_raw(key).await,
            Self::InMemory(c) => c.get_raw(key).await,
        }
    }

    #[tracing::instrument(name = "cache.set_raw", skip(self, value), fields(key = %key, ttl = ttl))]
    pub async fn set_raw(&self, key: &str, value: &str, ttl: u64) -> Result<()> {
        match self {
            Self::Redis(c) => c.set_raw(key, value, ttl).await,
            Self::InMemory(c) => c.set_raw(key, value, ttl).await,
        }
    }

    #[tracing::instrument(name = "cache.get", skip(self), fields(key = %key))]
    pub async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        match self.get_raw(key).await? {
            Some(v) => Ok(Some(serde_json::from_str(&v)?)),
            None => Ok(None),
        }
    }

    #[tracing::instrument(name = "cache.set", skip(self, value), fields(key = %key, ttl = ttl))]
    pub async fn set<T>(&self, key: &str, value: &T, ttl: u64) -> Result<()>
    where
        T: Serialize,
    {
        let serialized = serde_json::to_string(value)?;
        self.set_raw(key, &serialized, ttl).await
    }

    #[tracing::instrument(name = "cache.delete", skip(self), fields(key = %key))]
    pub async fn delete(&self, key: &str) -> Result<()> {
        match self {
            Self::Redis(c) => c.delete(key).await,
            Self::InMemory(c) => c.delete(key).await,
        }
    }
}

#[derive(Clone)]
pub struct RedisCache {
    connection: ConnectionManager,
}

impl RedisCache {
    /// Open a retrying connection manager, tolerating a Redis that is not yet up.
    ///
    /// Without this, a Redis that is briefly unavailable at boot fails the whole
    /// service start rather than starting a moment later.
    pub async fn new(redis_url: &str) -> Result<Self> {
        let mut last_err = None;

        for attempt in 0..STARTUP_CONNECT_ATTEMPTS {
            match Self::connect_once(redis_url).await {
                Ok(connection) => {
                    if attempt > 0 {
                        tracing::info!(
                            "Connected to Redis after {} attempt(s)",
                            attempt + 1
                        );
                    }
                    return Ok(Self { connection });
                }
                Err(e) => {
                    last_err = Some(e);
                    if attempt + 1 < STARTUP_CONNECT_ATTEMPTS {
                        warn!(
                            "Redis not reachable yet (attempt {}/{}): {}. Retrying in {}ms.",
                            attempt + 1,
                            STARTUP_CONNECT_ATTEMPTS,
                            last_err.as_ref().unwrap(),
                            STARTUP_CONNECT_BACKOFF.as_millis()
                        );
                        tokio::time::sleep(STARTUP_CONNECT_BACKOFF).await;
                    }
                }
            }
        }

        Err(last_err
            .map(|e| {
                anyhow::anyhow!(
                    "failed to connect to Redis at {redis_url} after {STARTUP_CONNECT_ATTEMPTS} attempts: {e}"
                )
            })
            .unwrap_or_else(|| {
                anyhow::anyhow!("failed to connect to Redis at {redis_url}")
            }))
    }

    async fn connect_once(redis_url: &str) -> Result<ConnectionManager> {
        let client = redis::Client::open(redis_url)?;
        ConnectionManager::new(client).await.map_err(Into::into)
    }

    /// Retry policy for individual cache operations.
    ///
    /// Separate from the Stellar policy: a cache miss is absorbable, so this must
    /// be far cheaper than retrying a Horizon call.
    fn op_policy() -> RetryPolicy {
        RetryPolicy::new(OP_RETRY_ATTEMPTS, OP_RETRY_BACKOFF)
    }

    /// Run one Redis command, retrying transient failures.
    ///
    /// `ConnectionManager` re-establishes the socket on its own, but a command
    /// issued while the connection is down still fails outright. Without this
    /// wrapper a single dropped connection turns into a 500 on whichever request
    /// happened to be in flight, even though the next request would have worked.
    async fn with_retry<T, F, Fut>(&self, label: &str, op: F) -> Result<T>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, RetryableError>>,
    {
        let policy = Self::op_policy();
        let breaker = Arc::new(CircuitBreaker::with_defaults());

        with_retry_and_cb(&breaker, &policy, op)
            .await
            .map_err(|e| anyhow::anyhow!("cache {label} failed: {}", e.into_string()))
    }

    async fn check_connection(&self) -> bool {
        let mut conn = self.connection.clone();
        redis::cmd("PING")
            .query_async::<_, String>(&mut conn)
            .await
            .is_ok()
    }

    async fn close(&self) {
        let mut conn = self.connection.clone();
        match redis::cmd("QUIT").query_async::<_, ()>(&mut conn).await {
            Ok(()) => tracing::info!("Redis connection closed cleanly during shutdown"),
            Err(e) => warn!("Error sending QUIT to Redis during shutdown: {}", e),
        }
    }

    async fn get_raw(&self, key: &str) -> Result<Option<String>> {
        let mut conn = self.connection.clone();
        let key = key.to_string();
        self.with_retry("get", move || {
            let mut conn = conn.clone();
            let key = key.clone();
            async move {
                conn.get::<_, Option<String>>(&key)
                    .await
                    .map_err(|e| RetryableError::Retryable(format!("redis GET failed: {e}")))
            }
        })
        .await
    }

    async fn set_raw(&self, key: &str, value: &str, ttl: u64) -> Result<()> {
        let mut conn = self.connection.clone();
        let key = key.to_string();
        let value = value.to_string();
        self.with_retry("set", move || {
            let mut conn = conn.clone();
            let key = key.clone();
            let value = value.clone();
            async move {
                conn.set_ex::<_, _, ()>(&key, &value, ttl)
                    .await
                    .map_err(|e| RetryableError::Retryable(format!("redis SET failed: {e}")))
            }
        })
        .await
    }

    async fn delete(&self, key: &str) -> Result<()> {
        let mut conn = self.connection.clone();
        let key = key.to_string();
        self.with_retry("delete", move || {
            let mut conn = conn.clone();
            let key = key.clone();
            async move {
                conn.del::<_, ()>(&key)
                    .await
                    .map_err(|e| RetryableError::Retryable(format!("redis DEL failed: {e}")))
            }
        })
        .await
    }
}

#[derive(Clone)]
pub struct InMemoryCache {
    store: Arc<RwLock<HashMap<String, String>>>,
}

impl Default for InMemoryCache {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryCache {
    pub fn new() -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn check_connection(&self) -> bool {
        true
    }

    async fn close(&self) {}

    async fn get_raw(&self, key: &str) -> Result<Option<String>> {
        let store = self.store.read().await;
        Ok(store.get(key).cloned())
    }

    async fn set_raw(&self, key: &str, key_val: &str, _ttl: u64) -> Result<()> {
        let mut store = self.store.write().await;
        store.insert(key.to_string(), key_val.to_string());
        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<()> {
        let mut store = self.store.write().await;
        store.remove(key);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory_backend() -> CacheBackend {
        CacheBackend::InMemory(InMemoryCache::new())
    }

    #[tokio::test]
    async fn test_set_and_get_string() {
        let cache = in_memory_backend();
        cache.set("key1", &"hello".to_string(), 3600).await.unwrap();
        let result: Option<String> = cache.get("key1").await.unwrap();
        assert_eq!(result, Some("hello".to_string()));
    }

    #[tokio::test]
    async fn test_get_miss_returns_none() {
        let cache = in_memory_backend();
        let result: Option<String> = cache.get("nonexistent").await.unwrap();
        assert_eq!(result, None);
    }

    #[tokio::test]
    async fn test_overwrite_value() {
        let cache = in_memory_backend();
        cache.set("key1", &"first".to_string(), 3600).await.unwrap();
        cache
            .set("key1", &"second".to_string(), 3600)
            .await
            .unwrap();
        let result: Option<String> = cache.get("key1").await.unwrap();
        assert_eq!(result, Some("second".to_string()));
    }

    #[tokio::test]
    async fn test_delete_removes_key() {
        let cache = in_memory_backend();
        cache.set("key1", &"value".to_string(), 3600).await.unwrap();
        cache.delete("key1").await.unwrap();
        let result: Option<String> = cache.get("key1").await.unwrap();
        assert_eq!(result, None);
    }

    #[tokio::test]
    async fn test_multiple_keys_independent() {
        let cache = in_memory_backend();
        cache.set("a", &"1".to_string(), 3600).await.unwrap();
        cache.set("b", &"2".to_string(), 3600).await.unwrap();
        cache.set("c", &"3".to_string(), 3600).await.unwrap();

        let a: Option<String> = cache.get("a").await.unwrap();
        let b: Option<String> = cache.get("b").await.unwrap();
        let c: Option<String> = cache.get("c").await.unwrap();

        assert_eq!(a, Some("1".to_string()));
        assert_eq!(b, Some("2".to_string()));
        assert_eq!(c, Some("3".to_string()));
    }

    #[tokio::test]
    async fn test_get_set_with_vec() {
        let cache = in_memory_backend();
        let data = vec![1u64, 2, 3, 4, 5];
        cache.set("numbers", &data, 3600).await.unwrap();
        let result: Option<Vec<u64>> = cache.get("numbers").await.unwrap();
        assert_eq!(result, Some(data));
    }

    #[tokio::test]
    async fn test_get_set_with_custom_struct() {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct TestData {
            name: String,
            value: i32,
        }

        let cache = in_memory_backend();
        let item = TestData {
            name: "test".to_string(),
            value: 42,
        };
        cache.set("struct_key", &item, 3600).await.unwrap();
        let result: Option<TestData> = cache.get("struct_key").await.unwrap();
        assert_eq!(result, Some(item));
    }

    #[tokio::test]
    async fn test_in_memory_check_connection_always_true() {
        let cache = in_memory_backend();
        assert!(cache.check_connection().await);
    }

    #[tokio::test]
    async fn test_delete_nonexistent_key_succeeds() {
        let cache = in_memory_backend();
        assert!(cache.delete("nonexistent").await.is_ok());
    }

    #[tokio::test]
    async fn test_set_raw_and_get_raw() {
        let cache = in_memory_backend();
        cache.set_raw("raw_key", "raw_value", 3600).await.unwrap();
        let result = cache.get_raw("raw_key").await.unwrap();
        assert_eq!(result, Some("raw_value".to_string()));
    }

    #[tokio::test]
    async fn test_cache_backend_enum_dispatch() {
        let cache = in_memory_backend();
        cache
            .set("enum_key", &"enum_value".to_string(), 3600)
            .await
            .unwrap();
        let result: Option<String> = cache.get("enum_key").await.unwrap();
        assert_eq!(result, Some("enum_value".to_string()));
    }

    // ── Redis resilience (#1369) ────────────────────────────────

    #[test]
    fn the_startup_connect_budget_is_bounded() {
        // A service that cannot reach Redis must fail rather than hang forever,
        // and must not fail instantly either.
        assert!(STARTUP_CONNECT_ATTEMPTS >= 2, "should retry at least once");
        assert!(
            STARTUP_CONNECT_ATTEMPTS <= 10,
            "boot should not be held hostage by Redis"
        );
    }

    #[test]
    fn the_operation_retry_budget_is_much_smaller_than_the_stellar_one() {
        // A cache miss is absorbable, so retrying it hard would add latency for
        // no benefit. This pins the asymmetry so nobody "fixes" it by aligning
        // the two.
        let cache = RetryPolicy::new(OP_RETRY_ATTEMPTS, OP_RETRY_BACKOFF);
        let stellar = RetryPolicy::default();

        assert!(
            cache.max_attempts < stellar.max_attempts,
            "cache retries ({}) should be fewer than stellar retries ({})",
            cache.max_attempts,
            stellar.max_attempts
        );
    }

    #[tokio::test]
    async fn connecting_to_an_unreachable_redis_fails_with_a_useful_message() {
        // No Redis is running in the test environment. The point is the message:
        // it should say how many attempts were made and name the URL, so an
        // operator can tell "Redis is down" from "the URL is wrong".
        let result = RedisCache::new("redis://127.0.0.1:6390").await;
        let err = result.expect_err("an unreachable Redis must not succeed");

        let message = format!("{err:#}");
        assert!(
            message.contains("127.0.0.1:6390"),
            "the message should name the endpoint: {message}"
        );
        assert!(
            message.contains(&STARTUP_CONNECT_ATTEMPTS.to_string()),
            "the message should say how many attempts were made: {message}"
        );
    }

    #[tokio::test]
    async fn the_in_memory_backend_survives_the_redis_failure_paths() {
        // The retry plumbing is Redis-specific; the in-memory backend must stay
        // usable so tests and local development never depend on a live Redis.
        let cache = in_memory_backend();
        assert!(cache.check_connection().await);
        cache
            .set("k", &"v".to_string(), 60)
            .await
            .unwrap();
        let got: Option<String> = cache.get("k").await.unwrap();
        assert_eq!(got, Some("v".to_string()));
        cache.delete("k").await.unwrap();
        assert!(cache.get::<String>("k").await.unwrap().is_none());
    }
}
