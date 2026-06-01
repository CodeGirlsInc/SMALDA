use crate::expiry::error::ExpiryError;
use crate::expiry::repository::ExpiryRepository;
use crate::expiry::types::{DocumentExpiryRecord, ExpiryPolicy, ExpiryStatus};
use chrono::Utc;

pub struct DocumentExpiryService {
    repository: ExpiryRepository,
}

impl DocumentExpiryService {
    pub fn new(repository: ExpiryRepository) -> Self {
        Self { repository }
    }

    pub async fn register_expiry(&self, document_hash: String, policy: ExpiryPolicy) -> Result<DocumentExpiryRecord, ExpiryError> {
        if policy.expires_at <= policy.issued_at {
            return Err(ExpiryError::InvalidDateRange);
        }
        let record = DocumentExpiryRecord::new(document_hash.clone(), &policy);
        self.repository.save_record(&record).await?;
        Ok(record)
    }

    pub async fn check_status(&self, document_hash: &str) -> Result<DocumentExpiryRecord, ExpiryError> {
        let mut record = self.repository.load_record(document_hash).await?.ok_or(ExpiryError::RecordNotFound)?;
        let now = Utc::now().timestamp();
        if record.is_expired(now) && record.status != ExpiryStatus::Expired {
            record.status = ExpiryStatus::Expired;
            self.repository.update_status(document_hash, ExpiryStatus::Expired, None).await?;
        }
        Ok(record)
    }

    pub async fn renew(&self, document_hash: &str, new_expires_at: i64) -> Result<DocumentExpiryRecord, ExpiryError> {
        let mut record = self.repository.load_record(document_hash).await?.ok_or(ExpiryError::RecordNotFound)?;
        if new_expires_at <= record.expires_at {
            return Err(ExpiryError::InvalidDateRange);
        }
        record.expires_at = new_expires_at;
        record.renewed_at = Some(Utc::now().timestamp());
        record.status = ExpiryStatus::Renewed;
        self.repository.save_record(&record).await?;
        Ok(record)
    }
}
