use crate::cache::CacheBackend;
use crate::multi_party::error::MultiPartyError;
use crate::multi_party::types::{CoSigningSession, MultiPartyPolicy, SignatureRecord};
use chrono::Utc;
use std::collections::HashSet;

const SESSION_PREFIX: &str = "multi_party:session:";
const HISTORY_PREFIX: &str = "multi_party:history:";
const SESSION_TTL: u64 = 24 * 60 * 60;

#[derive(Clone)]
pub struct MultiPartyRepository {
    cache: CacheBackend,
}

impl MultiPartyRepository {
    pub fn new(cache: CacheBackend) -> Self {
        Self { cache }
    }

    pub async fn save_session(&self, session: &CoSigningSession) -> Result<(), MultiPartyError> {
        let key = format!("{}{}", SESSION_PREFIX, session.document_hash);
        self.cache
            .set(&key, session, SESSION_TTL)
            .await
            .map_err(|_| MultiPartyError::StorageError)?;
        Ok(())
    }

    pub async fn load_session(&self, document_hash: &str) -> Result<Option<CoSigningSession>, MultiPartyError> {
        let key = format!("{}{}", SESSION_PREFIX, document_hash);
        self.cache.get(&key).await.map_err(|_| MultiPartyError::StorageError)
    }

    pub async fn append_signature(&self, document_hash: &str, record: &SignatureRecord) -> Result<(), MultiPartyError> {
        let key = format!("{}{}", HISTORY_PREFIX, document_hash);
        let mut history: Vec<SignatureRecord> = self.cache.get(&key).await.map_err(|_| MultiPartyError::StorageError)?.unwrap_or_default();
        history.push(record.clone());
        self.cache.set(&key, &history, SESSION_TTL).await.map_err(|_| MultiPartyError::StorageError)?;
        Ok(())
    }

    pub async fn get_history(&self, document_hash: &str) -> Result<Vec<SignatureRecord>, MultiPartyError> {
        let key = format!("{}{}", HISTORY_PREFIX, document_hash);
        self.cache.get(&key).await.map_err(|_| MultiPartyError::StorageError).map(|v| v.unwrap_or_default())
    }

    pub async fn delete_session(&self, document_hash: &str) -> Result<(), MultiPartyError> {
        let key = format!("{}{}", SESSION_PREFIX, document_hash);
        self.cache.delete(&key).await.map_err(|_| MultiPartyError::StorageError)
    }
}
