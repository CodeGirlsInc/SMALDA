use thiserror::Error;

#[derive(Debug, Error)]
pub enum MultiPartyError {
    #[error("session not found")]
    SessionNotFound,
    #[error("threshold not reached")]
    ThresholdNotReached,
    #[error("verifier not allowed")]
    VerifierNotAllowed,
    #[error("duplicate signature")]
    DuplicateSignature,
    #[error("invalid signature")]
    InvalidSignature,
    #[error("already finalized")]
    AlreadyFinalized,
    #[error("storage error")]
    StorageError,
}
