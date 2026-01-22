//! NAPI bindings for Node.js integration

use napi::bindgen_prelude::*;
use napi_derive::napi;
use pdf_parser::{PdfParser, ParseOptions, PdfMetadata};
use std::path::Path;

/// NAPI-compatible error type
#[napi]
pub struct PdfParserError {
    message: String,
}

#[napi]
impl PdfParserError {
    #[napi(getter)]
    pub fn message(&self) -> String {
        self.message.clone()
    }
}

/// NAPI-compatible PDF parser
#[napi]
pub struct NodePdfParser {
    parser: PdfParser,
}

#[napi]
impl NodePdfParser {
    /// Create a new PDF parser from a file path
    #[napi(constructor)]
    pub fn new(path: String) -> Result<Self> {
        let parser = PdfParser::new(&path)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
        Ok(Self { parser })
    }

    /// Create a new PDF parser with options
    #[napi(factory)]
    pub fn with_options(
        path: String,
        password: Option<String>,
        extract_images: Option<bool>,
        extract_tables: Option<bool>,
    ) -> Result<Self> {
        let options = ParseOptions {
            password,
            extract_images: extract_images.unwrap_or(false),
            extract_tables: extract_tables.unwrap_or(false),
            page_range: None,
        };
        let parser = PdfParser::with_options(&path, options)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
        Ok(Self { parser })
    }

    /// Create a PDF parser from bytes
    #[napi(factory)]
    pub fn from_bytes(
        data: Buffer,
        password: Option<String>,
        extract_images: Option<bool>,
        extract_tables: Option<bool>,
    ) -> Result<Self> {
        let options = ParseOptions {
            password,
            extract_images: extract_images.unwrap_or(false),
            extract_tables: extract_tables.unwrap_or(false),
            page_range: None,
        };
        let bytes = data.as_ref().to_vec();
        let parser = PdfParser::from_bytes(bytes, options)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
        Ok(Self { parser })
    }

    /// Get the PDF version
    #[napi]
    pub fn version(&self) -> String {
        self.parser.version()
    }

    /// Get the number of pages
    #[napi]
    pub fn page_count(&self) -> Result<u32> {
        self.parser.page_count()
            .map(|c| c as u32)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))
    }

    /// Extract all text from the PDF
    #[napi]
    pub fn extract_text(&self) -> Result<String> {
        self.parser.extract_text()
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))
    }

    /// Extract text from a specific page (1-indexed)
    #[napi]
    pub fn extract_text_page(&self, page_num: u32) -> Result<String> {
        self.parser.extract_text_page((page_num - 1) as usize)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))
    }

    /// Extract metadata from the PDF
    #[napi]
    pub fn extract_metadata(&self) -> Result<NodePdfMetadata> {
        let metadata = self.parser.extract_metadata()
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
        Ok(NodePdfMetadata::from(metadata))
    }

    /// Extract all images from the PDF
    #[napi]
    pub fn extract_images(&self) -> Result<Vec<Buffer>> {
        let images = self.parser.extract_images()
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
        Ok(images.into_iter().map(|img| Buffer::from(img)).collect())
    }

    /// Extract images from a specific page (1-indexed)
    #[napi]
    pub fn extract_images_page(&self, page_num: u32) -> Result<Vec<Buffer>> {
        let images = self.parser.extract_images_page((page_num - 1) as usize)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
        Ok(images.into_iter().map(|img| Buffer::from(img)).collect())
    }

    /// Extract all tables from the PDF
    #[napi]
    pub fn extract_tables(&self) -> Result<Vec<Vec<Vec<String>>>> {
        self.parser.extract_tables()
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))
    }

    /// Extract tables from a specific page (1-indexed)
    #[napi]
    pub fn extract_tables_page(&self, page_num: u32) -> Result<Vec<Vec<Vec<String>>>> {
        self.parser.extract_tables_page((page_num - 1) as usize)
            .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))
    }
}

/// NAPI-compatible PDF metadata
#[napi(object)]
pub struct NodePdfMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub modification_date: Option<String>,
    pub version: String,
    pub page_count: u32,
    pub encrypted: bool,
    pub custom: std::collections::HashMap<String, String>,
}

impl From<PdfMetadata> for NodePdfMetadata {
    fn from(metadata: PdfMetadata) -> Self {
        Self {
            title: metadata.title,
            author: metadata.author,
            subject: metadata.subject,
            keywords: metadata.keywords,
            creator: metadata.creator,
            producer: metadata.producer,
            creation_date: metadata.creation_date,
            modification_date: metadata.modification_date,
            version: metadata.version,
            page_count: metadata.page_count as u32,
            encrypted: metadata.encrypted,
            custom: metadata.custom,
        }
    }
}

/// Extract text from a PDF file (convenience function)
#[napi]
pub fn extract_text(path: String) -> Result<String> {
    let parser = PdfParser::new(&path)
        .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
    parser.extract_text()
        .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))
}

/// Extract metadata from a PDF file (convenience function)
#[napi]
pub fn extract_metadata(path: String) -> Result<NodePdfMetadata> {
    let parser = PdfParser::new(&path)
        .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
    let metadata = parser.extract_metadata()
        .map_err(|e| Error::new(Status::GenericFailure, format!("{}", e)))?;
    Ok(NodePdfMetadata::from(metadata))
}

