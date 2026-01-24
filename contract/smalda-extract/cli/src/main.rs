use clap::Parser;
use smalda_core::Extractor;
use std::fs;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "smalda-extract")]
#[command(about = "Extract metadata from land documents", long_about = None)]
struct Cli {
    /// Path to the text file to process
    #[arg(short, long, value_name = "FILE")]
    file: PathBuf,

    /// Output format (json)
    #[arg(short, long, default_value = "json")]
    format: String,
}

fn main() {
    let cli = Cli::parse();
    let content = fs::read_to_string(&cli.file).expect("Failed to read file");
    
    let extractor = Extractor::new();
    let metadata = extractor.extract(&content);

    let json = serde_json::to_string_pretty(&metadata).unwrap();
    println!("{}", json);
}
