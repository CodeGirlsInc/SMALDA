use crate::multi_party::error::MultiPartyError;
use crate::multi_party::repository::MultiPartyRepository;
use crate::multi_party::types::{CoSigningSession, MultiPartyPolicy, SignatureRecord};
use chrono::Utc;

pub struct MultiPartyVerificationService {
    repository: MultiPartyRepository,
}

impl MultiPartyVerificationService {
    pub fn new(repository: MultiPartyRepository) -> Self {
        Self { repository }
    }

    pub async fn initiate_signing(&self, document_hash: String, policy: MultiPartyPolicy) -> Result<CoSigningSession, MultiPartyError> {
        let session = CoSigningSession::new(document_hash.clone(), policy);
        self.repository.save_session(&session).await?;
        Ok(session)
    }

    pub async fn add_signature(&self, document_hash: &str, verifier_id: String, signature_blob: String) -> Result<CoSigningSession, MultiPartyError> {
        let mut session = self.repository.load_session(document_hash).await?
            .ok_or(MultiPartyError::SessionNotFound)?;

        let signature = SignatureRecord {
            verifier_id,
            signature_blob,
            timestamp: Utc::now().timestamp(),
            transaction_id: None,
        };

        session.add_signature(signature.clone())?;
        self.repository.save_session(&session).await?;
        self.repository.append_signature(document_hash, &signature).await?;

        Ok(session)
    }

    pub async fn check_status(&self, document_hash: &str) -> Result<CoSigningSession, MultiPartyError> {
        self.repository.load_session(document_hash).await?.ok_or(MultiPartyError::SessionNotFound)
    }

    pub async fn finalize_if_complete(&self, document_hash: &str) -> Result<CoSigningSession, MultiPartyError> {
        let mut session = self.repository.load_session(document_hash).await?
            .ok_or(MultiPartyError::SessionNotFound)?;

        if !session.is_complete() {
            return Err(MultiPartyError::ThresholdNotReached);
        }

        session.finalized = true;
        self.repository.save_session(&session).await?;
        self.repository.delete_session(document_hash).await?;

        Ok(session)
    }
}
