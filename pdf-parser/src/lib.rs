//! # PDF Parser Library
//!
//! A high-performance Rust library for parsing PDF documents and extracting
//! text, metadata, images, and structural information.
//!
//! ## Features
//!
//! - Parse PDF structure and extract text
//! - Extract metadata (author, dates, properties)
//! - Handle different PDF versions
//! - Support encrypted PDFs (basic)
//! - Extract images from PDFs
//! - Table detection and extraction
//! - Memory safe (no unsafe code unless necessary)
//!
//! ## Example
//!
//! ```no_run
//! use pdf_parser::{PdfParser, ParseOptions};
//!
//! let parser = PdfParser::new("document.pdf")?;
//! let text = parser.extract_text()?;
//! let metadata = parser.extract_metadata()?;
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```

pub mod error;
pub mod parser;
pub mod metadata;
pub mod text;
pub mod images;
pub mod tables;
pub mod encryption;

#[cfg(feature = "napi")]
pub mod napi_bindings;

pub use error::PdfError;
pub use parser::{PdfParser, ParseOptions};
pub use metadata::PdfMetadata;
pub use text::TextExtractor;
pub use images::ImageExtractor;
pub use tables::TableExtractor;

/// Re-export common types
pub use error::Result;

