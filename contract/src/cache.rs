use anyhow::Result;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub enum CacheBackend {
    Redis(RedisCache),
    InMemory(InMemoryCache),
}

impl CacheBackend {
    pub async fn check_connection(&self) -> bool {
        match self {
            Self::Redis(c) => c.check_connection().await,
            Self::InMemory(c) => c.check_connection().await,
        }
    }

    pub async fn get_raw(&self, key: &str) -> Result<Option<String>> {
        match self {
            Self::Redis(c) => c.get_raw(key).await,
            Self::InMemory(c) => c.get_raw(key).await,
        }
    }

    pub async fn set_raw(&self, key: &str, value: &str, ttl: u64) -> Result<()> {
        match self {
            Self::Redis(c) => c.set_raw(key, value, ttl).await,
            Self::InMemory(c) => c.set_raw(key, value, ttl).await,
        }
    }

    pub async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        match self.get_raw(key).await? {
            Some(v) => Ok(Some(serde_json::from_str(&v)?)),
            None => Ok(None),
        }
    }

    pub async fn set<T>(&self, key: &str, value: &T, ttl: u64) -> Result<()>
    where
        T: Serialize,
    {
        let serialized = serde_json::to_string(value)?;
        self.set_raw(key, &serialized, ttl).await
    }

    pub async fn delete(&self, key: &str) -> Result<()> {
        match self {
            Self::Redis(c) => c.delete(key).await,
            Self::InMemory(c) => c.delete(key).await,
        }
    }
}

pub struct RedisCache {
    connection: ConnectionManager,
}

impl RedisCache {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(Self { connection })
    }

    async fn check_connection(&self) -> bool {
        let mut conn = self.connection.clone();
        redis::cmd("PING")
            .query_async::<_, String>(&mut conn)
            .await
            .is_ok()
    }

    async fn get_raw(&self, key: &str) -> Result<Option<String>> {
        let mut conn = self.connection.clone();
        let value: Option<String> = conn.get(key).await?;
        Ok(value)
    }

    async fn set_raw(&self, key: &str, value: &str, ttl: u64) -> Result<()> {
        let mut conn = self.connection.clone();
        conn.set_ex::<_, _, ()>(key, value, ttl).await?;
        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<()> {
        let mut conn = self.connection.clone();
        conn.del::<_, ()>(key).await?;
        Ok(())
    }
}

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
        cache.set("key1", &"second".to_string(), 3600).await.unwrap();
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
        cache.set("enum_key", &"enum_value".to_string(), 3600).await.unwrap();
        let result: Option<String> = cache.get("enum_key").await.unwrap();
        assert_eq!(result, Some("enum_value".to_string()));
    }
}
