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
