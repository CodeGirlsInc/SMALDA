//! Expanded unit tests for hash_validator module (SC-10).
//!
//! Run with: cargo test --manifest-path contract/Cargo.toml

use stellar_doc_verifier::hash_validator::{HashAlgorithm, HashValidator, ValidationError};

// ── helpers ──────────────────────────────────────────────────────────────────

fn valid_sha256() -> &'static str {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

fn valid_sha512() -> &'static str {
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce\
     47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
}

// ── validate_sha256 ───────────────────────────────────────────────────────────

#[test]
fn sha256_valid_hash_passes() {
    assert!(HashValidator::validate_sha256(valid_sha256()).is_ok());
}

#[test]
fn sha256_empty_string_returns_empty_hash_error() {
    assert!(matches!(
        HashValidator::validate_sha256(""),
        Err(ValidationError::EmptyHash)
    ));
}

#[test]
fn sha256_whitespace_only_returns_empty_hash_error() {
    assert!(matches!(
        HashValidator::validate_sha256("   "),
        Err(ValidationError::EmptyHash)
    ));
}

#[test]
fn sha256_wrong_length_short() {
    let hash = "a".repeat(63);
    assert!(matches!(
        HashValidator::validate_sha256(&hash),
        Err(ValidationError::WrongLength { expected: 64, actual: 63 })
    ));
}

#[test]
fn sha256_wrong_length_long() {
    let hash = "a".repeat(65);
    assert!(matches!(
        HashValidator::validate_sha256(&hash),
        Err(ValidationError::WrongLength { expected: 64, actual: 65 })
    ));
}

#[test]
fn sha256_invalid_char_reports_position() {
    let mut hash = valid_sha256().to_string();
    hash.replace_range(5..6, "z");
    match HashValidator::validate_sha256(&hash) {
        Err(ValidationError::InvalidCharacter { position: 5, character: 'z' }) => {}
        other => panic!("unexpected: {:?}", other),
    }
}

#[test]
fn sha256_uppercase_input_passes_after_normalization() {
    let upper = valid_sha256().to_uppercase();
    let normalized = HashValidator::normalize(&upper);
    assert!(HashValidator::validate_sha256(&normalized).is_ok());
}

#[test]
fn sha256_uppercase_input_fails_without_normalization() {
    // 'A'–'F' are not valid hex chars in the validator (expects lowercase)
    let upper = valid_sha256().to_uppercase();
    assert!(HashValidator::validate_sha256(&upper).is_err());
}

// ── validate_sha512 ───────────────────────────────────────────────────────────

#[test]
fn sha512_valid_hash_passes() {
    assert!(HashValidator::validate_sha512(valid_sha512()).is_ok());
}

#[test]
fn sha512_empty_string_returns_empty_hash_error() {
    assert!(matches!(
        HashValidator::validate_sha512(""),
        Err(ValidationError::EmptyHash)
    ));
}

#[test]
fn sha512_wrong_length_short() {
    let hash = "a".repeat(127);
    assert!(matches!(
        HashValidator::validate_sha512(&hash),
        Err(ValidationError::WrongLength { expected: 128, actual: 127 })
    ));
}

#[test]
fn sha512_wrong_length_long() {
    let hash = "a".repeat(129);
    assert!(matches!(
        HashValidator::validate_sha512(&hash),
        Err(ValidationError::WrongLength { expected: 128, actual: 129 })
    ));
}

#[test]
fn sha512_invalid_char_reports_position() {
    let mut hash = valid_sha512().to_string();
    hash.replace_range(10..11, "x");
    match HashValidator::validate_sha512(&hash) {
        Err(ValidationError::InvalidCharacter { position: 10, character: 'x' }) => {}
        other => panic!("unexpected: {:?}", other),
    }
}

#[test]
fn sha512_uppercase_input_passes_after_normalization() {
    let upper = valid_sha512().to_uppercase();
    let normalized = HashValidator::normalize(&upper);
    assert!(HashValidator::validate_sha512(&normalized).is_ok());
}

// ── detect_algorithm ─────────────────────────────────────────────────────────

#[test]
fn detect_algorithm_sha256() {
    assert_eq!(
        HashValidator::detect_algorithm(valid_sha256()),
        Some(HashAlgorithm::SHA256)
    );
}

#[test]
fn detect_algorithm_sha512() {
    assert_eq!(
        HashValidator::detect_algorithm(valid_sha512()),
        Some(HashAlgorithm::SHA512)
    );
}

#[test]
fn detect_algorithm_ambiguous_returns_none() {
    assert_eq!(HashValidator::detect_algorithm("abc123"), None);
}

#[test]
fn detect_algorithm_empty_returns_none() {
    assert_eq!(HashValidator::detect_algorithm(""), None);
}

#[test]
fn detect_algorithm_uppercase_sha256_detected_after_normalize() {
    let upper = valid_sha256().to_uppercase();
    let normalized = HashValidator::normalize(&upper);
    assert_eq!(
        HashValidator::detect_algorithm(&normalized),
        Some(HashAlgorithm::SHA256)
    );
}

// ── normalize ────────────────────────────────────────────────────────────────

#[test]
fn normalize_trims_leading_and_trailing_whitespace() {
    assert_eq!(HashValidator::normalize("  abc  "), "abc");
}

#[test]
fn normalize_lowercases() {
    assert_eq!(HashValidator::normalize("ABCDEF"), "abcdef");
}

#[test]
fn normalize_trims_and_lowercases_combined() {
    assert_eq!(HashValidator::normalize("  ABCDEF123  "), "abcdef123");
}

#[test]
fn normalize_empty_string_stays_empty() {
    assert_eq!(HashValidator::normalize(""), "");
}

#[test]
fn normalize_already_normalized_is_unchanged() {
    assert_eq!(HashValidator::normalize(valid_sha256()), valid_sha256());
}
