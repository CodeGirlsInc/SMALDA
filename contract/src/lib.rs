use std::collections::HashMap;

/// Calculates Levenshtein distance between two strings
pub fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.len();
    let len2 = s2.len();
    let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

    for i in 0..=len1 {
        matrix[i][0] = i;
    }
    for j in 0..=len2 {
        matrix[0][j] = j;
    }

    for (i, c1) in s1.chars().enumerate() {
        for (j, c2) in s2.chars().enumerate() {
            let cost = if c1 == c2 { 0 } else { 1 };
            matrix[i + 1][j + 1] = std::cmp::min(
                std::cmp::min(
                    matrix[i][j + 1] + 1,
                    matrix[i + 1][j] + 1,
                ),
                matrix[i][j] + cost,
            );
        }
    }

    matrix[len1][len2]
}

/// Normalizes Levenshtein distance to similarity score (0-1)
pub fn levenshtein_similarity(s1: &str, s2: &str) -> f64 {
    let distance = levenshtein_distance(s1, s2) as f64;
    let max_len = s1.len().max(s2.len()) as f64;
    if max_len == 0.0 {
        return 1.0;
    }
    1.0 - (distance / max_len)
}

/// Tokenizes text and calculates term frequencies
fn tokenize(text: &str) -> HashMap<String, usize> {
    let mut frequencies = HashMap::new();
    let words: Vec<&str> = text
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();

    for word in words {
        *frequencies.entry(word.to_string()).or_insert(0) += 1;
    }
    frequencies
}

/// Calculates cosine similarity between two documents
pub fn cosine_similarity(doc1: &str, doc2: &str) -> f64 {
    let freq1 = tokenize(doc1);
    let freq2 = tokenize(doc2);

    if freq1.is_empty() || freq2.is_empty() {
        return 0.0;
    }

    let mut dot_product = 0.0;
    for (word, count1) in &freq1 {
        if let Some(&count2) = freq2.get(word) {
            dot_product += (*count1 as f64) * (count2 as f64);
        }
    }

    let magnitude1: f64 = freq1.values().map(|c| (*c as f64).powi(2)).sum::<f64>().sqrt();
    let magnitude2: f64 = freq2.values().map(|c| (*c as f64).powi(2)).sum::<f64>().sqrt();

    if magnitude1 == 0.0 || magnitude2 == 0.0 {
        return 0.0;
    }

    dot_product / (magnitude1 * magnitude2)
}

/// Document similarity result
#[derive(Debug, Clone)]
pub struct SimilarityResult {
    pub doc1: String,
    pub doc2: String,
    pub cosine: f64,
    pub levenshtein: f64,
    pub combined: f64,
}

/// Compares two documents and returns similarity scores
pub fn compare_documents(doc1: &str, doc2: &str) -> SimilarityResult {
    let cosine = cosine_similarity(doc1, doc2);
    let levenshtein = levenshtein_similarity(doc1, doc2);
    let combined = (cosine + levenshtein) / 2.0;

    SimilarityResult {
        doc1: doc1.to_string(),
        doc2: doc2.to_string(),
        cosine,
        levenshtein,
        combined,
    }
}

/// Batch comparison of documents against a reference
pub fn batch_compare(reference: &str, documents: &[&str]) -> Vec<SimilarityResult> {
    documents
        .iter()
        .map(|doc| compare_documents(reference, doc))
        .collect()
}

/// Finds duplicate documents above threshold
pub fn find_duplicates(documents: &[&str], threshold: f64) -> Vec<(usize, usize, f64)> {
    let mut duplicates = Vec::new();
    for i in 0..documents.len() {
        for j in (i + 1)..documents.len() {
            let similarity = compare_documents(documents[i], documents[j]).combined;
            if similarity >= threshold {
                duplicates.push((i, j, similarity));
            }
        }
    }
    duplicates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());
    duplicates
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein_identical() {
        assert_eq!(levenshtein_distance("hello", "hello"), 0);
    }

    #[test]
    fn test_levenshtein_different() {
        assert_eq!(levenshtein_distance("kitten", "sitting"), 3);
    }

    #[test]
    fn test_levenshtein_similarity() {
        let sim = levenshtein_similarity("hello", "hello");
        assert!(sim >= 0.99);
    }

    #[test]
    fn test_cosine_identical() {
        let sim = cosine_similarity("hello world", "hello world");
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_different() {
        let sim = cosine_similarity("hello world", "goodbye world");
        assert!(sim > 0.0 && sim < 1.0);
    }

    #[test]
    fn test_compare_documents() {
        let result = compare_documents("the quick brown fox", "the quick brown fox");
        assert!(result.combined >= 0.99);
    }

    #[test]
    fn test_batch_compare() {
        let ref_doc = "hello world";
        let docs = vec!["hello world", "hello there", "goodbye"];
        let results = batch_compare(ref_doc, &docs);
        assert_eq!(results.len(), 3);
        assert!(results[0].combined > results[2].combined);
    }

    #[test]
    fn test_find_duplicates() {
        let docs = vec![
            "the quick brown fox jumps",
            "the quick brown fox jumps",
            "completely different text",
        ];
        let duplicates = find_duplicates(&docs, 0.8);
        assert!(duplicates.len() > 0);
        assert_eq!(duplicates[0].0, 0);
        assert_eq!(duplicates[0].1, 1);
    }
}
