//! PDF metadata extraction

use lopdf::Document;
use serde::{Serialize, Deserialize};
use crate::error::{PdfError, Result};

/// PDF metadata information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfMetadata {
    /// Document title
    pub title: Option<String>,
    /// Document author
    pub author: Option<String>,
    /// Document subject
    pub subject: Option<String>,
    /// Document keywords
    pub keywords: Option<String>,
    /// Document creator (application that created the PDF)
    pub creator: Option<String>,
    /// Document producer (application that produced the PDF)
    pub producer: Option<String>,
    /// Creation date
    pub creation_date: Option<String>,
    /// Modification date
    pub modification_date: Option<String>,
    /// PDF version
    pub version: String,
    /// Number of pages
    pub page_count: usize,
    /// Whether the PDF is encrypted
    pub encrypted: bool,
    /// Additional custom properties
    #[serde(flatten)]
    pub custom: std::collections::HashMap<String, String>,
}

impl PdfMetadata {
    /// Extract metadata from a PDF document
    pub fn from_document(document: &Document) -> Result<Self> {
        let info_dict = document.trailer.get("Info")
            .and_then(|obj| obj.as_dict())
            .ok_or_else(|| PdfError::MetadataExtraction("Info dictionary not found".to_string()))?;

        let mut metadata = Self {
            title: Self::get_string(info_dict, "Title"),
            author: Self::get_string(info_dict, "Author"),
            subject: Self::get_string(info_dict, "Subject"),
            keywords: Self::get_string(info_dict, "Keywords"),
            creator: Self::get_string(info_dict, "Creator"),
            producer: Self::get_string(info_dict, "Producer"),
            creation_date: Self::get_string(info_dict, "CreationDate"),
            modification_date: Self::get_string(info_dict, "ModDate"),
            version: format!("{}.{}", document.version.0, document.version.1),
            page_count: document.get_pages().len(),
            encrypted: document.is_encrypted(),
            custom: std::collections::HashMap::new(),
        };

        // Extract custom properties
        for (key, value) in info_dict.iter() {
            let key_str = key.to_string();
            if !Self::is_standard_key(&key_str) {
                if let Some(val_str) = Self::value_to_string(value) {
                    metadata.custom.insert(key_str, val_str);
                }
            }
        }

        Ok(metadata)
    }

    fn get_string(dict: &lopdf::Dictionary, key: &str) -> Option<String> {
        dict.get(key)
            .and_then(|obj| Self::value_to_string(obj))
    }

    fn value_to_string(obj: &lopdf::Object) -> Option<String> {
        match obj {
            lopdf::Object::String(s, _) => Some(s.clone()),
            lopdf::Object::Name(n) => Some(n.clone()),
            lopdf::Object::Integer(i) => Some(i.to_string()),
            lopdf::Object::Real(r) => Some(r.to_string()),
            lopdf::Object::Boolean(b) => Some(b.to_string()),
            _ => None,
        }
    }

    fn is_standard_key(key: &str) -> bool {
        matches!(key, "Title" | "Author" | "Subject" | "Keywords" | 
                      "Creator" | "Producer" | "CreationDate" | "ModDate" |
                      "Trapped" | "PTEX.FullBanner")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_creation() {
        // Test would require a sample PDF
    }
}

