//! Core PDF parser implementation

use std::path::Path;
use std::fs::File;
use std::io::Read;
use lopdf::Document;
use crate::error::{PdfError, Result};
use crate::metadata::PdfMetadata;
use crate::text::TextExtractor;
use crate::images::ImageExtractor;
use crate::tables::TableExtractor;
use crate::encryption::EncryptionHandler;

/// Options for PDF parsing
#[derive(Debug, Clone, Default)]
pub struct ParseOptions {
    /// Password for encrypted PDFs
    pub password: Option<String>,
    /// Extract images
    pub extract_images: bool,
    /// Extract tables
    pub extract_tables: bool,
    /// Page range (None = all pages)
    pub page_range: Option<(usize, usize)>,
}

/// Main PDF parser struct
pub struct PdfParser {
    document: Document,
    options: ParseOptions,
    encryption_handler: EncryptionHandler,
}

impl PdfParser {
    /// Create a new PDF parser from a file path
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        Self::with_options(path, ParseOptions::default())
    }

    /// Create a new PDF parser with options
    pub fn with_options<P: AsRef<Path>>(path: P, options: ParseOptions) -> Result<Self> {
        let path = path.as_ref();
        let mut file = File::open(path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        Self::from_bytes(buffer, options)
    }

    /// Create a PDF parser from bytes
    pub fn from_bytes(data: Vec<u8>, options: ParseOptions) -> Result<Self> {
        let document = Document::load_mem(&data)
            .map_err(|e| PdfError::Parse(format!("Failed to load PDF: {}", e)))?;

        let encryption_handler = EncryptionHandler::new(&document)?;

        // Check if PDF is encrypted
        if document.is_encrypted() {
            if let Some(ref password) = options.password {
                if !encryption_handler.decrypt(&document, password)? {
                    return Err(PdfError::InvalidPassword);
                }
            } else {
                return Err(PdfError::PasswordRequired);
            }
        }

        Ok(Self {
            document,
            options,
            encryption_handler,
        })
    }

    /// Get the PDF version
    pub fn version(&self) -> String {
        format!("{}.{}", self.document.version.0, self.document.version.1)
    }

    /// Get the number of pages
    pub fn page_count(&self) -> Result<usize> {
        Ok(self.document.get_pages().len())
    }

    /// Extract all text from the PDF
    pub fn extract_text(&self) -> Result<String> {
        let extractor = TextExtractor::new(&self.document);
        let page_range = self.options.page_range;
        
        if let Some((start, end)) = page_range {
            extractor.extract_range(start, end)
        } else {
            extractor.extract_all()
        }
    }

    /// Extract text from a specific page
    pub fn extract_text_page(&self, page_num: usize) -> Result<String> {
        let extractor = TextExtractor::new(&self.document);
        extractor.extract_page(page_num)
    }

    /// Extract metadata from the PDF
    pub fn extract_metadata(&self) -> Result<PdfMetadata> {
        PdfMetadata::from_document(&self.document)
    }

    /// Extract all images from the PDF
    pub fn extract_images(&self) -> Result<Vec<Vec<u8>>> {
        if !self.options.extract_images {
            return Ok(Vec::new());
        }
        let extractor = ImageExtractor::new(&self.document);
        extractor.extract_all()
    }

    /// Extract images from a specific page
    pub fn extract_images_page(&self, page_num: usize) -> Result<Vec<Vec<u8>>> {
        if !self.options.extract_images {
            return Ok(Vec::new());
        }
        let extractor = ImageExtractor::new(&self.document);
        extractor.extract_page(page_num)
    }

    /// Extract tables from the PDF
    pub fn extract_tables(&self) -> Result<Vec<Vec<Vec<String>>>> {
        if !self.options.extract_tables {
            return Ok(Vec::new());
        }
        let extractor = TableExtractor::new(&self.document);
        extractor.extract_all()
    }

    /// Extract tables from a specific page
    pub fn extract_tables_page(&self, page_num: usize) -> Result<Vec<Vec<Vec<String>>>> {
        if !self.options.extract_tables {
            return Ok(Vec::new());
        }
        let extractor = TableExtractor::new(&self.document);
        extractor.extract_page(page_num)
    }

    /// Get the underlying document (for advanced use cases)
    pub fn document(&self) -> &Document {
        &self.document
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parser_creation() {
        // This test would require a sample PDF file
        // For now, we'll just test that the struct compiles
    }
}

