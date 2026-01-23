use anyhow::Result;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};

pub struct CacheClient {
    connection: ConnectionManager,
}

impl CacheClient {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(Self { connection })
    }

    pub async fn check_connection(&self) -> bool {
        let mut conn = self.connection.clone();
        redis::cmd("PING").query_async::<_, String>(&mut conn).await.is_ok()
    }

    pub async fn get<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        let mut conn = self.connection.clone();
        let value: Option<String> = conn.get(key).await?;
        
        match value {
            Some(v) => Ok(Some(serde_json::from_str(&v)?)),
            None => Ok(None),
        }
    }

    pub async fn set<T>(&self, key: &str, value: &T, ttl: u64) -> Result<()>
    where
        T: Serialize,
    {
        let mut conn = self.connection.clone();
        let serialized = serde_json::to_string(value)?;
        conn.set_ex(key, serialized, ttl).await?;
        Ok(())
    }
}
