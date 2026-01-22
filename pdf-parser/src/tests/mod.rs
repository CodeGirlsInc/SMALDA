//! Integration tests for PDF parser

#[cfg(test)]
mod integration_tests {
    use pdf_parser::{PdfParser, ParseOptions};
    use std::fs;
    use tempfile::TempDir;

    // Note: These tests require sample PDF files
    // In a real scenario, you would include test PDFs in the test fixtures

    #[test]
    #[ignore] // Requires test PDF file
    fn test_basic_text_extraction() {
        // This test would require a sample PDF
        // let parser = PdfParser::new("tests/fixtures/sample.pdf").unwrap();
        // let text = parser.extract_text().unwrap();
        // assert!(!text.is_empty());
    }

    #[test]
    #[ignore] // Requires test PDF file
    fn test_metadata_extraction() {
        // let parser = PdfParser::new("tests/fixtures/sample.pdf").unwrap();
        // let metadata = parser.extract_metadata().unwrap();
        // assert!(metadata.page_count > 0);
    }

    #[test]
    #[ignore] // Requires test PDF file
    fn test_page_count() {
        // let parser = PdfParser::new("tests/fixtures/sample.pdf").unwrap();
        // let count = parser.page_count().unwrap();
        // assert!(count > 0);
    }

    #[test]
    #[ignore] // Requires test PDF file
    fn test_single_page_extraction() {
        // let parser = PdfParser::new("tests/fixtures/sample.pdf").unwrap();
        // let text = parser.extract_text_page(0).unwrap();
        // assert!(!text.is_empty());
    }

    #[test]
    fn test_parse_options() {
        let options = ParseOptions {
            password: Some("test".to_string()),
            extract_images: true,
            extract_tables: true,
            page_range: Some((0, 2)),
        };

        assert_eq!(options.password, Some("test".to_string()));
        assert!(options.extract_images);
        assert!(options.extract_tables);
        assert_eq!(options.page_range, Some((0, 2)));
    }
}

