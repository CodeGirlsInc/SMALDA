use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExpiryError {
    #[error("document not anchored")]
    DocumentNotAnchored,
    #[error("invalid date range")]
    InvalidDateRange,
    #[error("record not found")]
    RecordNotFound,
    #[error("already expired")]
    AlreadyExpired,
    #[error("storage error")]
    StorageError,
    #[error("stellar anchor failed")]
    StellarAnchorFailed,
}
