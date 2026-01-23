//! Basic example of using the PDF parser

use pdf_parser::{PdfParser, ParseOptions};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Basic text extraction
    println!("=== Basic Text Extraction ===");
    let parser = PdfParser::new("example.pdf")?;
    let text = parser.extract_text()?;
    println!("Extracted {} characters", text.len());
    println!("First 200 characters:\n{}", &text[..text.len().min(200)]);

    // Metadata extraction
    println!("\n=== Metadata Extraction ===");
    let metadata = parser.extract_metadata()?;
    println!("Title: {:?}", metadata.title);
    println!("Author: {:?}", metadata.author);
    println!("Pages: {}", metadata.page_count);
    println!("Version: {}", metadata.version);

    // Page-specific extraction
    println!("\n=== Page-Specific Extraction ===");
    if parser.page_count()? > 0 {
        let first_page = parser.extract_text_page(0)?;
        println!("First page text ({} chars)", first_page.len());
    }

    Ok(())
}

