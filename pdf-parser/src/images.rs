//! Image extraction from PDF documents

use lopdf::Document;
use crate::error::{PdfError, Result};

/// Image extractor for PDF documents
pub struct ImageExtractor<'a> {
    document: &'a Document,
}

impl<'a> ImageExtractor<'a> {
    /// Create a new image extractor
    pub fn new(document: &'a Document) -> Self {
        Self { document }
    }

    /// Extract all images from the PDF
    pub fn extract_all(&self) -> Result<Vec<Vec<u8>>> {
        let pages = self.document.get_pages();
        let mut all_images = Vec::new();

        for page_num in 0..pages.len() {
            match self.extract_page(page_num) {
                Ok(mut images) => all_images.append(&mut images),
                Err(e) => {
                    eprintln!("Warning: Failed to extract images from page {}: {}", page_num + 1, e);
                }
            }
        }

        Ok(all_images)
    }

    /// Extract images from a specific page (0-indexed)
    pub fn extract_page(&self, page_num: usize) -> Result<Vec<Vec<u8>>> {
        let pages = self.document.get_pages();
        if page_num >= pages.len() {
            return Err(PdfError::PageNotFound(page_num));
        }

        let (page_id, _) = pages.get(page_num)
            .ok_or_else(|| PdfError::PageNotFound(page_num))?;

        let page_dict = self.document.get_dictionary(*page_id)
            .map_err(|e| PdfError::ImageExtraction(format!("Failed to get page dictionary: {}", e)))?;

        let mut images = Vec::new();

        // Extract images from XObject resources
        if let Ok(Some(resources)) = page_dict.get(b"Resources").map(|obj| obj.as_dict()) {
            if let Ok(Some(xobjects)) = resources.get(b"XObject").map(|obj| obj.as_dict()) {
                for (name, xobject_ref) in xobjects.iter() {
                    if let Ok(xobject_dict) = self.document.get_dictionary(*xobject_ref) {
                        if let Ok(Some(subtype)) = xobject_dict.get(b"Subtype").map(|obj| obj.as_name_str()) {
                            if subtype == "Image" {
                                if let Ok(image_data) = self.extract_image_data(xobject_dict) {
                                    images.push(image_data);
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(images)
    }

    /// Extract image data from an XObject dictionary
    fn extract_image_data(&self, image_dict: &lopdf::Dictionary) -> Result<Vec<u8>> {
        // Get the image stream
        let stream = self.document.get_stream(image_dict)
            .map_err(|e| PdfError::ImageExtraction(format!("Failed to get image stream: {}", e)))?;

        // Get image parameters
        let width = image_dict.get(b"Width")
            .and_then(|obj| obj.as_i64())
            .ok_or_else(|| PdfError::ImageExtraction("Width not found".to_string()))?;

        let height = image_dict.get(b"Height")
            .and_then(|obj| obj.as_i64())
            .ok_or_else(|| PdfError::ImageExtraction("Height not found".to_string()))?;

        let color_space = image_dict.get(b"ColorSpace")
            .and_then(|obj| obj.as_name_str())
            .unwrap_or("DeviceRGB");

        let bits_per_component = image_dict.get(b"BitsPerComponent")
            .and_then(|obj| obj.as_i64())
            .unwrap_or(8);

        // Decode the image data based on filter
        let filters = image_dict.get(b"Filter")
            .and_then(|obj| {
                match obj {
                    lopdf::Object::Name(n) => Some(vec![n.clone()]),
                    lopdf::Object::Array(arr) => {
                        Some(arr.iter().filter_map(|o| o.as_name_str()).collect())
                    }
                    _ => None,
                }
            })
            .unwrap_or_default();

        let mut image_data = stream;

        // Apply filters in reverse order
        for filter in filters.iter().rev() {
            image_data = match filter.as_str() {
                "FlateDecode" | "Fl" => {
                    // Decompress using flate
                    use flate2::read::DeflateDecoder;
                    use std::io::Read;
                    let mut decoder = DeflateDecoder::new(&image_data[..]);
                    let mut decoded = Vec::new();
                    decoder.read_to_end(&mut decoded)
                        .map_err(|e| PdfError::ImageExtraction(format!("FlateDecode failed: {}", e)))?;
                    decoded
                }
                "DCTDecode" | "DCT" => {
                    // JPEG - already decoded
                    image_data
                }
                "CCITTFaxDecode" | "CCF" => {
                    // CCITT Fax - would need special decoder
                    // For now, return as-is
                    image_data
                }
                _ => {
                    // Unknown filter - return as-is
                    image_data
                }
            };
        }

        // Convert to a standard image format if needed
        // For now, we return the raw decoded data
        Ok(image_data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_extractor_creation() {
        // Test would require a sample PDF with images
    }
}

