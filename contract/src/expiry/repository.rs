use crate::cache::CacheBackend;
use crate::expiry::error::ExpiryError;
use crate::expiry::types::{DocumentExpiryRecord, ExpiryStatus};

const RECORD_PREFIX: &str = "expiry:record:";
const HISTORY_PREFIX: &str = "expiry:history:";
const RECORD_TTL: u64 = 30 * 24 * 60 * 60;

#[derive(Clone)]
pub struct ExpiryRepository {
    cache: CacheBackend,
}

impl ExpiryRepository {
    pub fn new(cache: CacheBackend) -> Self {
        Self { cache }
    }

    pub async fn save_record(&self, record: &DocumentExpiryRecord) -> Result<(), ExpiryError> {
        let key = format!("{}{}", RECORD_PREFIX, record.document_hash);
        self.cache
            .set(&key, record, RECORD_TTL)
            .await
            .map_err(|_| ExpiryError::StorageError)
    }

    pub async fn load_record(&self, document_hash: &str) -> Result<Option<DocumentExpiryRecord>, ExpiryError> {
        let key = format!("{}{}", RECORD_PREFIX, document_hash);
        self.cache.get(&key).await.map_err(|_| ExpiryError::StorageError)
    }

    pub async fn update_status(&self, document_hash: &str, status: ExpiryStatus, stellar_memo: Option<String>) -> Result<(), ExpiryError> {
        let mut record = self.load_record(document_hash).await?.ok_or(ExpiryError::RecordNotFound)?;
        record.status = status;
        record.stellar_memo = stellar_memo;
        self.save_record(&record).await
    }
}

impl ExpiryRepository {
    pub fn new(cache: CacheBackend) -> Self {
        Self { cache }
    }

    pub async fn save_record(&self, record: &DocumentExpiryRecord) -> Result<(), ExpiryError> {
        let key = format!("{}{}", RECORD_PREFIX, record.document_hash);
        self.cache
            .set(&key, record, RECORD_TTL)
            .await
            .map_err(|_| ExpiryError::StorageError)
    }

    pub async fn load_record(&self, document_hash: &str) -> Result<Option<DocumentExpiryRecord>, ExpiryError> {
        let key = format!("{}{}", RECORD_PREFIX, document_hash);
        self.cache.get(&key).await.map_err(|_| ExpiryError::StorageError)
    }

    pub async fn update_status(&self, document_hash: &str, status: ExpiryStatus, stellar_memo: Option<String>) -> Result<(), ExpiryError> {
        let mut record = self.load_record(document_hash).await?.ok_or(ExpiryError::RecordNotFound)?;
        record.status = status;
        record.stellar_memo = stellar_memo;
        self.save_record(&record).await
    }
}
