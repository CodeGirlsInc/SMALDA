use std::collections::HashSet;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifierProfile {
    pub id: String,
    pub display_name: String,
    pub public_key: Option<String>,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureRecord {
    pub verifier_id: String,
    pub signature_blob: String,
    pub timestamp: i64,
    pub transaction_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiPartyPolicy {
    pub required_signatures: u8,
    pub allowed_verifiers: HashSet<String>,
    pub policy_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoSigningSession {
    pub document_hash: String,
    pub policy: MultiPartyPolicy,
    pub signatures: Vec<SignatureRecord>,
    pub finalized: bool,
    pub created_at: i64,
}

impl CoSigningSession {
    pub fn new(document_hash: String, policy: MultiPartyPolicy) -> Self {
        Self {
            document_hash,
            policy,
            signatures: Vec::new(),
            finalized: false,
            created_at: chrono::Utc::now().timestamp(),
        }
    }

    pub fn add_signature(&mut self, signature: SignatureRecord) -> Result<(), super::error::MultiPartyError> {
        if self.finalized {
            return Err(super::error::MultiPartyError::AlreadyFinalized);
        }
        if self.signatures.iter().any(|s| s.verifier_id == signature.verifier_id) {
            return Err(super::error::MultiPartyError::DuplicateSignature);
        }
        if !self.policy.allowed_verifiers.contains(&signature.verifier_id) {
            return Err(super::error::MultiPartyError::VerifierNotAllowed);
        }
        self.signatures.push(signature);
        Ok(())
    }

    pub fn is_complete(&self) -> bool {
        self.signatures.len() >= self.policy.required_signatures as usize
    }

    pub fn remaining(&self) -> u8 {
        (self.policy.required_signatures as i32 - self.signatures.len() as i32).max(0) as u8
    }
}
