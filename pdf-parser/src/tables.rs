//! Table detection and extraction from PDF documents

use lopdf::Document;
use regex::Regex;
use crate::error::{PdfError, Result};

/// Table extractor for PDF documents
pub struct TableExtractor<'a> {
    document: &'a Document,
}

impl<'a> TableExtractor<'a> {
    /// Create a new table extractor
    pub fn new(document: &'a Document) -> Self {
        Self { document }
    }

    /// Extract all tables from the PDF
    pub fn extract_all(&self) -> Result<Vec<Vec<Vec<String>>>> {
        let pages = self.document.get_pages();
        let mut all_tables = Vec::new();

        for page_num in 0..pages.len() {
            match self.extract_page(page_num) {
                Ok(mut tables) => all_tables.append(&mut tables),
                Err(e) => {
                    eprintln!("Warning: Failed to extract tables from page {}: {}", page_num + 1, e);
                }
            }
        }

        Ok(all_tables)
    }

    /// Extract tables from a specific page (0-indexed)
    pub fn extract_page(&self, page_num: usize) -> Result<Vec<Vec<Vec<String>>>> {
        // First, extract text from the page
        use crate::text::TextExtractor;
        let text_extractor = TextExtractor::new(self.document);
        let text = text_extractor.extract_page(page_num)?;

        // Detect tables in the text
        self.detect_tables(&text)
    }

    /// Detect tables in text content
    fn detect_tables(&self, text: &str) -> Result<Vec<Vec<Vec<String>>>> {
        let mut tables = Vec::new();

        // Split text into lines
        let lines: Vec<&str> = text.lines().collect();

        // Look for table patterns
        // Common table indicators:
        // - Multiple spaces or tabs between columns
        // - Consistent column alignment
        // - Header rows with separators

        let mut current_table: Option<Vec<Vec<String>>> = None;
        let mut table_start = 0;

        for (i, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                // Empty line might indicate end of table
                if let Some(table) = current_table.take() {
                    if table.len() > 1 {
                        tables.push(table);
                    }
                }
                continue;
            }

            // Check if line looks like a table row (has multiple columns)
            let columns = self.parse_table_row(trimmed);
            
            if columns.len() >= 2 {
                // This looks like a table row
                if let Some(ref mut table) = current_table {
                    // Check if column count matches
                    if table.is_empty() || table[0].len() == columns.len() {
                        table.push(columns);
                    } else {
                        // Column count mismatch - might be a new table
                        if table.len() > 1 {
                            tables.push(table.clone());
                        }
                        current_table = Some(vec![columns]);
                    }
                } else {
                    current_table = Some(vec![columns]);
                    table_start = i;
                }
            } else {
                // Not a table row
                if let Some(table) = current_table.take() {
                    if table.len() > 1 {
                        tables.push(table);
                    }
                }
            }
        }

        // Add final table if exists
        if let Some(table) = current_table {
            if table.len() > 1 {
                tables.push(table);
            }
        }

        Ok(tables)
    }

    /// Parse a line into table columns
    fn parse_table_row(&self, line: &str) -> Vec<String> {
        // Try multiple delimiters
        // First, try tab
        if line.contains('\t') {
            return line.split('\t')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        // Try multiple spaces (2+ spaces)
        let re = Regex::new(r"\s{2,}").unwrap();
        if re.is_match(line) {
            return re.split(line)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        // Try pipe separator
        if line.contains('|') {
            return line.split('|')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        // Try comma (CSV-like)
        if line.contains(',') && line.matches(',').count() >= 2 {
            return line.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }

        // Single column
        vec![line.to_string()]
    }

    /// Detect table boundaries using heuristics
    fn detect_table_boundaries(&self, lines: &[&str]) -> Vec<(usize, usize)> {
        let mut boundaries = Vec::new();
        let mut in_table = false;
        let mut start = 0;

        for (i, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            let columns = self.parse_table_row(trimmed);

            if columns.len() >= 2 {
                if !in_table {
                    in_table = true;
                    start = i;
                }
            } else {
                if in_table {
                    in_table = false;
                    if i > start {
                        boundaries.push((start, i - 1));
                    }
                }
            }
        }

        if in_table {
            boundaries.push((start, lines.len() - 1));
        }

        boundaries
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_row_parsing() {
        // Create a minimal test without needing a real document
        // We'll test the parse_table_row logic directly
        use lopdf::Document;
        
        // Create a dummy document for the struct
        let doc = Document::with_version("1.4".to_string());
        let extractor = TableExtractor {
            document: &doc,
        };

        let row1 = "Name    Age    City";
        let cols1 = extractor.parse_table_row(row1);
        assert_eq!(cols1.len(), 3);

        let row2 = "John\t25\tNew York";
        let cols2 = extractor.parse_table_row(row2);
        assert_eq!(cols2.len(), 3);
    }
}

