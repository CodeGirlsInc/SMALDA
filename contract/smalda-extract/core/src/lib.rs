use regex::Regex;
use serde::{Deserialize, Serialize};
use chrono::NaiveDate;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractedMetadata {
    pub entities: Vec<Entity>,
    pub dates: Vec<String>,
    pub coordinates: Vec<Coordinate>,
    pub confidence_score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Entity {
    pub text: String,
    pub label: String, // "PERSON", "LOCATION"
    pub confidence: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Coordinate {
    pub lat: f64,
    pub lon: f64,
}

pub struct Extractor {
    patterns: HashMap<String, Regex>,
}

impl Extractor {
    pub fn new() -> Self {
        let mut patterns = HashMap::new();
        // Basic Heuristic NER Patterns (In production, replace with NLP models)
        patterns.insert("date".to_string(), Regex::new(r"\b\d{4}-\d{2}-\d{2}\b|\b\d{2}/\d{2}/\d{4}\b").unwrap());
        patterns.insert("coord".to_string(), Regex::new(r"Lat:\s*(-?\d+\.\d+),\s*Lon:\s*(-?\d+\.\d+)").unwrap());
        patterns.insert("person".to_string(), Regex::new(r"(?i)\b(Mr\.|Ms\.|Mrs\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)").unwrap());
        patterns.insert("location".to_string(), Regex::new(r"(?i)\b(located at|property at)\s+([A-Z0-9][\w\s,]+)").unwrap());
        
        Self { patterns }
    }

    pub fn extract(&self, text: &str) -> ExtractedMetadata {
        let mut entities = Vec::new();
        let mut dates = Vec::new();
        let mut coordinates = Vec::new();

        // 1. Person Extraction
        if let Some(re) = self.patterns.get("person") {
            for cap in re.captures_iter(text) {
                entities.push(Entity {
                    text: cap[2].to_string(),
                    label: "PERSON".to_string(),
                    confidence: 0.85,
                });
            }
        }

        // 2. Location Extraction
        if let Some(re) = self.patterns.get("location") {
            for cap in re.captures_iter(text) {
                entities.push(Entity {
                    text: cap[2].trim().to_string(),
                    label: "LOCATION".to_string(),
                    confidence: 0.80,
                });
            }
        }

        // 3. Date Parsing & Normalization
        if let Some(re) = self.patterns.get("date") {
            for cap in re.find_iter(text) {
                // Basic normalization attempt
                if let Ok(parsed) = NaiveDate::parse_from_str(cap.as_str(), "%Y-%m-%d") {
                    dates.push(parsed.format("%Y-%m-%d").to_string());
                } else if let Ok(parsed) = NaiveDate::parse_from_str(cap.as_str(), "%d/%m/%Y") {
                    dates.push(parsed.format("%Y-%m-%d").to_string());
                }
            }
        }

        // 4. Coordinate Extraction
        if let Some(re) = self.patterns.get("coord") {
            for cap in re.captures_iter(text) {
                let lat = cap[1].parse::<f64>().unwrap_or(0.0);
                let lon = cap[2].parse::<f64>().unwrap_or(0.0);
                // Basic validation (-90 to 90, -180 to 180)
                if lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0 {
                    coordinates.push(Coordinate { lat, lon });
                }
            }
        }

        ExtractedMetadata {
            entities,
            dates,
            coordinates,
            confidence_score: 0.92, // Placeholder for aggregate logic
        }
    }

    // Fuzzy matching for entity resolution
    pub fn fuzzy_match(&self, target: &str, candidates: Vec<&str>) -> Option<String> {
        candidates.into_iter()
            .max_by_key(|c| (strsim::jaro_winkler(target, c) * 100.0) as u32)
            .map(|s| s.to_string())
    }
}
