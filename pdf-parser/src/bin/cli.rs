//! Command-line interface for PDF parser

use clap::{Parser, Subcommand};
use pdf_parser::{PdfParser, ParseOptions};
use std::path::PathBuf;
use std::fs;

#[derive(Parser)]
#[command(name = "pdf-parser-cli")]
#[command(about = "High-performance PDF text extraction tool", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Extract text from a PDF
    Text {
        /// Input PDF file
        #[arg(short, long)]
        input: PathBuf,
        /// Output text file (default: stdout)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Extract from specific page (1-indexed)
        #[arg(short, long)]
        page: Option<usize>,
        /// Extract from page range (e.g., 1-5)
        #[arg(short = 'r', long)]
        range: Option<String>,
    },
    /// Extract metadata from a PDF
    Metadata {
        /// Input PDF file
        #[arg(short, long)]
        input: PathBuf,
        /// Output as JSON
        #[arg(short, long)]
        json: bool,
    },
    /// Extract images from a PDF
    Images {
        /// Input PDF file
        #[arg(short, long)]
        input: PathBuf,
        /// Output directory for images
        #[arg(short, long)]
        output: PathBuf,
        /// Extract from specific page (1-indexed)
        #[arg(short, long)]
        page: Option<usize>,
    },
    /// Extract tables from a PDF
    Tables {
        /// Input PDF file
        #[arg(short, long)]
        input: PathBuf,
        /// Output JSON file
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Extract from specific page (1-indexed)
        #[arg(short, long)]
        page: Option<usize>,
    },
    /// Show PDF information
    Info {
        /// Input PDF file
        #[arg(short, long)]
        input: PathBuf,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Text { input, output, page, range } => {
            handle_text_extraction(input, output, page, range);
        }
        Commands::Metadata { input, json } => {
            handle_metadata_extraction(input, json);
        }
        Commands::Images { input, output, page } => {
            handle_image_extraction(input, output, page);
        }
        Commands::Tables { input, output, page } => {
            handle_table_extraction(input, output, page);
        }
        Commands::Info { input } => {
            handle_info(input);
        }
    }
}

fn handle_text_extraction(input: PathBuf, output: Option<PathBuf>, page: Option<usize>, range: Option<String>) {
    let options = ParseOptions {
        password: None,
        extract_images: false,
        extract_tables: false,
        page_range: parse_range(range, page),
    };

    let parser = match PdfParser::with_options(&input, options) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error: Failed to parse PDF: {}", e);
            std::process::exit(1);
        }
    };

    let text = if let Some(page_num) = page {
        match parser.extract_text_page(page_num - 1) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("Error: Failed to extract text: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        match parser.extract_text() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("Error: Failed to extract text: {}", e);
                std::process::exit(1);
            }
        }
    };

    if let Some(output_path) = output {
        fs::write(&output_path, text).expect("Failed to write output file");
        println!("Text extracted to: {}", output_path.display());
    } else {
        print!("{}", text);
    }
}

fn handle_metadata_extraction(input: PathBuf, json: bool) {
    let parser = match PdfParser::new(&input) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error: Failed to parse PDF: {}", e);
            std::process::exit(1);
        }
    };

    let metadata = match parser.extract_metadata() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Error: Failed to extract metadata: {}", e);
            std::process::exit(1);
        }
    };

    if json {
        let json = serde_json::to_string_pretty(&metadata).expect("Failed to serialize metadata");
        println!("{}", json);
    } else {
        println!("Title: {}", metadata.title.as_deref().unwrap_or("N/A"));
        println!("Author: {}", metadata.author.as_deref().unwrap_or("N/A"));
        println!("Subject: {}", metadata.subject.as_deref().unwrap_or("N/A"));
        println!("Creator: {}", metadata.creator.as_deref().unwrap_or("N/A"));
        println!("Producer: {}", metadata.producer.as_deref().unwrap_or("N/A"));
        println!("Creation Date: {}", metadata.creation_date.as_deref().unwrap_or("N/A"));
        println!("Modification Date: {}", metadata.modification_date.as_deref().unwrap_or("N/A"));
        println!("Version: {}", metadata.version);
        println!("Pages: {}", metadata.page_count);
        println!("Encrypted: {}", metadata.encrypted);
    }
}

fn handle_image_extraction(input: PathBuf, output: PathBuf, page: Option<usize>) {
    let options = ParseOptions {
        password: None,
        extract_images: true,
        extract_tables: false,
        page_range: None,
    };

    let parser = match PdfParser::with_options(&input, options) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error: Failed to parse PDF: {}", e);
            std::process::exit(1);
        }
    };

    fs::create_dir_all(&output).expect("Failed to create output directory");

    let images = if let Some(page_num) = page {
        match parser.extract_images_page(page_num - 1) {
            Ok(imgs) => imgs,
            Err(e) => {
                eprintln!("Error: Failed to extract images: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        match parser.extract_images() {
            Ok(imgs) => imgs,
            Err(e) => {
                eprintln!("Error: Failed to extract images: {}", e);
                std::process::exit(1);
            }
        }
    };

    for (i, image_data) in images.iter().enumerate() {
        let filename = output.join(format!("image_{:04}.png", i + 1));
        fs::write(&filename, image_data).expect("Failed to write image");
        println!("Extracted image: {}", filename.display());
    }

    println!("Extracted {} images to {}", images.len(), output.display());
}

fn handle_table_extraction(input: PathBuf, output: Option<PathBuf>, page: Option<usize>) {
    let options = ParseOptions {
        password: None,
        extract_images: false,
        extract_tables: true,
        page_range: None,
    };

    let parser = match PdfParser::with_options(&input, options) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error: Failed to parse PDF: {}", e);
            std::process::exit(1);
        }
    };

    let tables = if let Some(page_num) = page {
        match parser.extract_tables_page(page_num - 1) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("Error: Failed to extract tables: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        match parser.extract_tables() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("Error: Failed to extract tables: {}", e);
                std::process::exit(1);
            }
        }
    };

    let json = serde_json::to_string_pretty(&tables).expect("Failed to serialize tables");

    if let Some(output_path) = output {
        fs::write(&output_path, json).expect("Failed to write output file");
        println!("Tables extracted to: {}", output_path.display());
    } else {
        println!("{}", json);
    }

    println!("Extracted {} tables", tables.len());
}

fn handle_info(input: PathBuf) {
    let parser = match PdfParser::new(&input) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error: Failed to parse PDF: {}", e);
            std::process::exit(1);
        }
    };

    println!("PDF Information:");
    println!("  Version: {}", parser.version());
    match parser.page_count() {
        Ok(count) => println!("  Pages: {}", count),
        Err(e) => println!("  Pages: Error - {}", e),
    }

    match parser.extract_metadata() {
        Ok(metadata) => {
            println!("  Title: {}", metadata.title.as_deref().unwrap_or("N/A"));
            println!("  Author: {}", metadata.author.as_deref().unwrap_or("N/A"));
            println!("  Encrypted: {}", metadata.encrypted);
        }
        Err(e) => {
            println!("  Metadata: Error - {}", e);
        }
    }
}

fn parse_range(range: Option<String>, page: Option<usize>) -> Option<(usize, usize)> {
    if let Some(page_num) = page {
        return Some((page_num - 1, page_num - 1));
    }

    if let Some(range_str) = range {
        let parts: Vec<&str> = range_str.split('-').collect();
        if parts.len() == 2 {
            if let (Ok(start), Ok(end)) = (parts[0].parse::<usize>(), parts[1].parse::<usize>()) {
                return Some((start - 1, end - 1));
            }
        }
    }

    None
}

