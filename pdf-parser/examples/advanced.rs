//! Advanced example with images and tables

use pdf_parser::{PdfParser, ParseOptions};
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let options = ParseOptions {
        extract_images: true,
        extract_tables: true,
        ..Default::default()
    };

    let parser = PdfParser::with_options("example.pdf", options)?;

    // Extract images
    println!("=== Image Extraction ===");
    let images = parser.extract_images()?;
    println!("Found {} images", images.len());
    
    for (i, image_data) in images.iter().enumerate() {
        let filename = format!("image_{:04}.png", i + 1);
        fs::write(&filename, image_data)?;
        println!("Saved: {} ({} bytes)", filename, image_data.len());
    }

    // Extract tables
    println!("\n=== Table Extraction ===");
    let tables = parser.extract_tables()?;
    println!("Found {} tables", tables.len());
    
    for (i, table) in tables.iter().enumerate() {
        println!("\nTable {} ({} rows, {} cols):", 
                 i + 1, 
                 table.len(),
                 table.first().map(|r| r.len()).unwrap_or(0));
        
        // Print first few rows
        for (row_idx, row) in table.iter().take(5).enumerate() {
            println!("  Row {}: {:?}", row_idx + 1, row);
        }
    }

    Ok(())
}

