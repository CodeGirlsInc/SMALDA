# PDF Parser Library

A high-performance Rust library for parsing PDF documents and extracting text, metadata, images, and structural information.

## Features

- ✅ Parse PDF structure and extract text
- ✅ Extract metadata (author, dates, properties)
- ✅ Handle different PDF versions
- ✅ Support encrypted PDFs (basic)
- ✅ Extract images from PDFs
- ✅ Table detection and extraction
- ✅ Command-line interface
- ✅ FFI bindings for Node.js (NAPI-RS)
- ✅ Performance benchmarks
- ✅ Comprehensive error handling
- ✅ Memory safe (no unsafe code unless necessary)

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
pdf-parser = { path = "../pdf-parser" }
```

Or from crates.io (when published):

```toml
[dependencies]
pdf-parser = "0.1.0"
```

## Usage

### Basic Text Extraction

```rust
use pdf_parser::PdfParser;

let parser = PdfParser::new("document.pdf")?;
let text = parser.extract_text()?;
println!("{}", text);
```

### Extract Metadata

```rust
use pdf_parser::PdfParser;

let parser = PdfParser::new("document.pdf")?;
let metadata = parser.extract_metadata()?;
println!("Title: {:?}", metadata.title);
println!("Author: {:?}", metadata.author);
println!("Pages: {}", metadata.page_count);
```

### Extract from Specific Page

```rust
use pdf_parser::PdfParser;

let parser = PdfParser::new("document.pdf")?;
let text = parser.extract_text_page(0)?; // 0-indexed
```

### Extract Images

```rust
use pdf_parser::PdfParser;
use pdf_parser::ParseOptions;

let options = ParseOptions {
    extract_images: true,
    ..Default::default()
};
let parser = PdfParser::with_options("document.pdf", options)?;
let images = parser.extract_images()?;
```

### Extract Tables

```rust
use pdf_parser::PdfParser;
use pdf_parser::ParseOptions;

let options = ParseOptions {
    extract_tables: true,
    ..Default::default()
};
let parser = PdfParser::with_options("document.pdf", options)?;
let tables = parser.extract_tables()?;
```

### Encrypted PDFs

```rust
use pdf_parser::PdfParser;
use pdf_parser::ParseOptions;

let options = ParseOptions {
    password: Some("password123".to_string()),
    ..Default::default()
};
let parser = PdfParser::with_options("encrypted.pdf", options)?;
```

## Command-Line Interface

The library includes a CLI tool for quick PDF operations:

### Extract Text

```bash
# Extract all text
pdf-parser-cli text -i document.pdf

# Extract to file
pdf-parser-cli text -i document.pdf -o output.txt

# Extract from specific page
pdf-parser-cli text -i document.pdf --page 1

# Extract from page range
pdf-parser-cli text -i document.pdf --range 1-5
```

### Extract Metadata

```bash
# Human-readable format
pdf-parser-cli metadata -i document.pdf

# JSON format
pdf-parser-cli metadata -i document.pdf --json
```

### Extract Images

```bash
pdf-parser-cli images -i document.pdf -o ./images/
```

### Extract Tables

```bash
pdf-parser-cli tables -i document.pdf -o tables.json
```

### Show PDF Information

```bash
pdf-parser-cli info -i document.pdf
```

## Node.js Integration

The library provides NAPI bindings for Node.js integration:

### Installation

```bash
npm install pdf-parser
```

### Usage

```javascript
const { NodePdfParser } = require('pdf-parser');

// Create parser
const parser = new NodePdfParser('document.pdf');

// Extract text
const text = parser.extractText();

// Extract metadata
const metadata = parser.extractMetadata();

// Extract from specific page
const pageText = parser.extractTextPage(1); // 1-indexed
```

Or using convenience functions:

```javascript
const { extractText, extractMetadata } = require('pdf-parser');

const text = extractText('document.pdf');
const metadata = extractMetadata('document.pdf');
```

## Performance

The library is designed for high performance:

- Memory-efficient parsing
- Optimized text extraction algorithms
- Parallel processing where possible
- Zero-copy operations where applicable

Run benchmarks:

```bash
cargo bench --features benchmarks
```

## Testing

Run tests:

```bash
cargo test
```

Note: Some integration tests require sample PDF files in `tests/fixtures/`.

## Error Handling

The library uses comprehensive error types:

```rust
use pdf_parser::{PdfError, Result};

match parser.extract_text() {
    Ok(text) => println!("{}", text),
    Err(PdfError::PasswordRequired) => {
        println!("PDF is encrypted, password required");
    }
    Err(PdfError::PageNotFound(page)) => {
        println!("Page {} not found", page);
    }
    Err(e) => println!("Error: {}", e),
}
```

## PDF Version Support

The library supports:
- PDF 1.0 through PDF 2.0
- Standard encryption (RC4 and AES)
- Various compression methods
- Embedded fonts and images

## Limitations

- Advanced encryption (certificate-based) not yet supported
- Complex table structures may require manual post-processing
- Some PDF features (forms, annotations) have limited support

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

## Acknowledgments

Built for the SMALDA project - an AI-powered system for analyzing land ownership documents.

