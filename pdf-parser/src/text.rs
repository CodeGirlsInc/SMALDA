//! Text extraction from PDF documents

use lopdf::Document;
use pdf::file::File as PdfFile;
use pdf::object::*;
use std::io::Cursor;
use regex;
use crate::error::{PdfError, Result};

/// Text extractor for PDF documents
pub struct TextExtractor<'a> {
    document: &'a Document,
}

impl<'a> TextExtractor<'a> {
    /// Create a new text extractor
    pub fn new(document: &'a Document) -> Self {
        Self { document }
    }

    /// Extract all text from the PDF
    pub fn extract_all(&self) -> Result<String> {
        let pages = self.document.get_pages();
        let mut text_parts = Vec::new();

        for (page_num, _) in pages.iter().enumerate() {
            match self.extract_page(page_num) {
                Ok(text) => text_parts.push(text),
                Err(e) => {
                    // Log error but continue with other pages
                    eprintln!("Warning: Failed to extract text from page {}: {}", page_num + 1, e);
                }
            }
        }

        Ok(text_parts.join("\n\n"))
    }

    /// Extract text from a range of pages (0-indexed, inclusive)
    pub fn extract_range(&self, start: usize, end: usize) -> Result<String> {
        let pages = self.document.get_pages();
        if start >= pages.len() || end >= pages.len() || start > end {
            return Err(PdfError::PageNotFound(start));
        }

        let mut text_parts = Vec::new();
        for page_num in start..=end {
            match self.extract_page(page_num) {
                Ok(text) => text_parts.push(text),
                Err(e) => {
                    eprintln!("Warning: Failed to extract text from page {}: {}", page_num + 1, e);
                }
            }
        }

        Ok(text_parts.join("\n\n"))
    }

    /// Extract text from a specific page (0-indexed)
    pub fn extract_page(&self, page_num: usize) -> Result<String> {
        let pages = self.document.get_pages();
        if page_num >= pages.len() {
            return Err(PdfError::PageNotFound(page_num));
        }

        // Try using pdf-extract crate for better text extraction
        self.extract_with_pdf_extract(page_num)
            .or_else(|_| self.extract_with_lopdf(page_num))
    }

    /// Extract text using pdf-extract crate (more accurate)
    fn extract_with_pdf_extract(&self, page_num: usize) -> Result<String> {
        // pdf-extract requires file path, so we'll use lopdf for in-memory extraction
        // This method is kept for future enhancement
        Err(PdfError::TextExtraction("pdf-extract requires file path".to_string()))
    }

    /// Extract text using lopdf
    fn extract_with_lopdf(&self, page_num: usize) -> Result<String> {
        let pages = self.document.get_pages();
        let (page_id, _) = pages.get(page_num)
            .ok_or_else(|| PdfError::PageNotFound(page_num))?;

        let page_dict = self.document.get_dictionary(*page_id)
            .map_err(|e| PdfError::TextExtraction(format!("Failed to get page dictionary: {}", e)))?;

        // Get content stream
        let contents = page_dict.get(b"Contents")
            .map_err(|_| PdfError::TextExtraction("Contents not found".to_string()))?;

        let mut text_content = String::new();

        // Handle different content types
        match contents {
            lopdf::Object::Array(ref arr) => {
                for content_ref in arr {
                    if let Ok(content_stream) = self.document.get_dictionary(*content_ref) {
                        if let Ok(text) = self.extract_text_from_stream(content_stream) {
                            text_content.push_str(&text);
                        }
                    }
                }
            }
            lopdf::Object::Reference(ref id) => {
                if let Ok(content_stream) = self.document.get_dictionary(*id) {
                    if let Ok(text) = self.extract_text_from_stream(content_stream) {
                        text_content.push_str(&text);
                    }
                }
            }
            _ => {}
        }

        // Also try to extract text from annotations and form fields
        if let Ok(Some(annotations)) = page_dict.get(b"Annots").map(|obj| obj.as_array()) {
            for annot_ref in annotations {
                if let Ok(annot_dict) = self.document.get_dictionary(*annot_ref) {
                    if let Ok(Some(contents)) = annot_dict.get(b"Contents").map(|obj| obj.as_string()) {
                        text_content.push_str(&contents);
                        text_content.push('\n');
                    }
                }
            }
        }

        Ok(text_content)
    }

    /// Extract text from a content stream
    fn extract_text_from_stream(&self, stream: &lopdf::Dictionary) -> Result<String> {
        // Get the stream data
        let stream_data = self.document.get_stream(stream)
            .map_err(|e| PdfError::TextExtraction(format!("Failed to get stream: {}", e)))?;
        
        // Parse PDF content operators to extract text
        // This is a simplified implementation - full implementation would parse
        // all PDF text operators (Tj, TJ, ', ", etc.)
        let text = Self::parse_pdf_content_operators(&stream_data)?;
        Ok(text)
    }

    /// Parse PDF content operators to extract text
    fn parse_pdf_content_operators(data: &[u8]) -> Result<String> {
        let content = String::from_utf8_lossy(data);
        let mut text_parts = Vec::new();
        
        // Simple regex-based extraction of text between parentheses
        // This is a basic implementation - a full implementation would
        // properly parse PDF content streams
        let re = regex::Regex::new(r"\((.*?)\)").unwrap();
        for cap in re.captures_iter(&content) {
            if let Some(text) = cap.get(1) {
                text_parts.push(text.as_str().to_string());
            }
        }
        
        // Also look for text in brackets (for TJ operator)
        let re_brackets = regex::Regex::new(r"\[(.*?)\]").unwrap();
        for cap in re_brackets.captures_iter(&content) {
            if let Some(text) = cap.get(1) {
                let inner_text = text.as_str();
                // Extract text from array format
                let inner_re = regex::Regex::new(r"\((.*?)\)").unwrap();
                for inner_cap in inner_re.captures_iter(inner_text) {
                    if let Some(t) = inner_cap.get(1) {
                        text_parts.push(t.as_str().to_string());
                    }
                }
            }
        }
        
        Ok(text_parts.join(" "))
    }
}

/// Advanced text extraction using pdf crate
pub struct AdvancedTextExtractor {
    // This would use the pdf crate for more accurate extraction
}

impl AdvancedTextExtractor {
    /// Extract text with better accuracy using pdf crate
    pub fn extract_from_bytes(data: &[u8], page_num: usize) -> Result<String> {
        let file = PdfFile::<Cursor<Vec<u8>>>::from_data(data)
            .map_err(|e| PdfError::TextExtraction(format!("Failed to parse PDF: {}", e)))?;

        let pages = file.pages();
        if page_num >= pages.len() {
            return Err(PdfError::PageNotFound(page_num));
        }

        let page = pages.get(page_num)
            .map_err(|e| PdfError::TextExtraction(format!("Failed to get page: {}", e)))?;

        let mut text_content = String::new();

        // Extract text from page content
        if let Ok(Some(contents)) = page.contents(&file) {
            for content in contents {
                if let Ok(text) = Self::extract_text_from_content(&file, content) {
                    text_content.push_str(&text);
                }
            }
        }

        Ok(text_content)
    }

    fn extract_text_from_content(file: &PdfFile<Cursor<Vec<u8>>>, content: &Content) -> Result<String> {
        let mut text = String::new();
        
        for op in &content.operations {
            match op.operator.as_str() {
                "Tj" | "TJ" => {
                    // Text showing operators
                    for arg in &op.operands {
                        if let Ok(s) = arg.as_string() {
                            text.push_str(&s);
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_extractor_creation() {
        // Test would require a sample PDF
    }
}

