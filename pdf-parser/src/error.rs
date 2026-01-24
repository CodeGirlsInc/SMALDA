//! Error types for PDF parsing operations

use thiserror::Error;

/// Errors that can occur during PDF parsing
#[derive(Error, Debug)]
pub enum PdfError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("PDF parsing error: {0}")]
    Parse(String),

    #[error("PDF version not supported: {0}")]
    UnsupportedVersion(String),

    #[error("Encrypted PDF: {0}")]
    Encrypted(String),

    #[error("Password required for encrypted PDF")]
    PasswordRequired,

    #[error("Invalid password")]
    InvalidPassword,

    #[error("Page not found: {0}")]
    PageNotFound(usize),

    #[error("Text extraction failed: {0}")]
    TextExtraction(String),

    #[error("Image extraction failed: {0}")]
    ImageExtraction(String),

    #[error("Table extraction failed: {0}")]
    TableExtraction(String),

    #[error("Metadata extraction failed: {0}")]
    MetadataExtraction(String),

    #[error("Invalid PDF structure: {0}")]
    InvalidStructure(String),
}

/// Result type alias for PDF operations
pub type Result<T> = std::result::Result<T, PdfError>;

