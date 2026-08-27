//! Hex hash normalization and validation for SHA-256 and SHA-512 document
//! hashes.

/// Reasons a candidate hash string fails validation.
#[derive(Debug, PartialEq, Eq, Clone)]
pub enum ValidationError {
    WrongLength { expected: usize, actual: usize },
    InvalidCharacter { position: usize, character: char },
    EmptyHash,
    InvalidUtf8,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::EmptyHash => write!(f, "hash must not be empty"),
            ValidationError::WrongLength { expected, actual } => {
                write!(
                    f,
                    "hash has wrong length: expected {} characters, got {}",
                    expected, actual
                )
            }
            ValidationError::InvalidCharacter {
                position,
                character,
            } => {
                write!(
                    f,
                    "hash contains invalid character '{}' at position {}",
                    character, position
                )
            }
            ValidationError::InvalidUtf8 => write!(f, "hash contains invalid UTF-8 bytes"),
        }
    }
}

impl std::error::Error for ValidationError {}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum HashAlgorithm {
    SHA256,
    SHA512,
}

/// Stateless helper for normalizing and validating hex-encoded hashes.
/// All methods are associated functions - there is nothing to construct.
pub struct HashValidator;

impl HashValidator {
    pub fn normalize(hash: &str) -> String {
        hash.trim().to_lowercase()
    }

    pub fn validate_sha256(hash: &str) -> Result<(), ValidationError> {
        Self::validate_with_length(hash, 64)
    }

    pub fn validate_sha512(hash: &str) -> Result<(), ValidationError> {
        Self::validate_with_length(hash, 128)
    }

    /// Validates raw bytes representing a UTF-8 hex-encoded SHA-256 hash.
    pub fn validate_sha256_bytes(bytes: &[u8]) -> Result<(), ValidationError> {
        Self::validate_bytes(bytes, 64)
    }

    /// Validates raw bytes representing a UTF-8 hex-encoded SHA-512 hash.
    pub fn validate_sha512_bytes(bytes: &[u8]) -> Result<(), ValidationError> {
        Self::validate_bytes(bytes, 128)
    }

    /// Validates raw bytes representing a UTF-8 hex-encoded hash against an expected length.
    pub fn validate_bytes(bytes: &[u8], expected_len: usize) -> Result<(), ValidationError> {
        let s = std::str::from_utf8(bytes).map_err(|_| ValidationError::InvalidUtf8)?;
        Self::validate_with_length(s, expected_len)
    }

    fn validate_with_length(hash: &str, expected_len: usize) -> Result<(), ValidationError> {
        let normalized = Self::normalize(hash);

        if normalized.is_empty() {
            return Err(ValidationError::EmptyHash);
        }

        let actual_len = normalized.len();
        if actual_len != expected_len {
            return Err(ValidationError::WrongLength {
                expected: expected_len,
                actual: actual_len,
            });
        }

        for (idx, ch) in normalized.chars().enumerate() {
            let is_hex = matches!(ch, '0'..='9' | 'a'..='f');
            if !is_hex {
                return Err(ValidationError::InvalidCharacter {
                    position: idx,
                    character: ch,
                });
            }
        }

        Ok(())
    }

    pub fn detect_algorithm(hash: &str) -> Option<HashAlgorithm> {
        let normalized = Self::normalize(hash);
        match normalized.len() {
            64 => Some(HashAlgorithm::SHA256),
            128 => Some(HashAlgorithm::SHA512),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_sha256() -> &'static str {
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }

    fn sample_sha512() -> &'static str {
        "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce\
         47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
    }

    #[test]
    fn normalize_trims_and_lowercases() {
        let input = "  ABCdef123  ";
        let normalized = HashValidator::normalize(input);
        assert_eq!(normalized, "abcdef123");
    }

    #[test]
    fn sha256_valid_hash_passes() {
        assert!(HashValidator::validate_sha256(sample_sha256()).is_ok());
    }

    #[test]
    fn sha512_valid_hash_passes() {
        assert!(HashValidator::validate_sha512(sample_sha512()).is_ok());
    }

    // ── Non-UTF8 and binary input tests ─────────────────────────

    #[test]
    fn validate_sha256_bytes_rejects_invalid_utf8_binary_sequences() {
        let invalid_utf8_cases: Vec<&[u8]> = vec![
            &[0xFF, 0xFE, 0xFD],
            &[0x80, 0x81, 0x82],
            &[0xC3, 0x28],              // Invalid 2-byte sequence
            &[0xE2, 0x28, 0xA1],        // Invalid 3-byte sequence
            &[0xF0, 0x90, 0x28, 0xBC],  // Invalid 4-byte sequence
            b"e3b0c442\xFF\xFE98fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ];

        for bytes in invalid_utf8_cases {
            assert_eq!(
                HashValidator::validate_sha256_bytes(bytes),
                Err(ValidationError::InvalidUtf8),
                "expected InvalidUtf8 for {:?}",
                bytes
            );
        }
    }

    #[test]
    fn validate_sha512_bytes_rejects_invalid_utf8_binary_sequences() {
        let invalid_utf8_cases: Vec<&[u8]> = vec![
            &[0xFF, 0xAA, 0xBB],
            &[0xC0, 0xAF],              // Overlong sequence
            &[0xED, 0xA0, 0x80],        // UTF-16 surrogate
            b"cf83e135\xFF\xAAeefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
        ];

        for bytes in invalid_utf8_cases {
            assert_eq!(
                HashValidator::validate_sha512_bytes(bytes),
                Err(ValidationError::InvalidUtf8),
                "expected InvalidUtf8 for {:?}",
                bytes
            );
        }
    }

    #[test]
    fn validate_bytes_valid_utf8_hashes() {
        assert!(HashValidator::validate_sha256_bytes(sample_sha256().as_bytes()).is_ok());
        assert!(HashValidator::validate_sha512_bytes(sample_sha512().as_bytes()).is_ok());
    }

    #[test]
    fn sha256_rejects_non_ascii_unicode_and_binary_characters() {
        // Unicode character (snowflake/snowman) embedded in 64-char string
        let char_count_64_with_unicode = format!("{}☃{}", "a".repeat(30), "b".repeat(33));
        assert_eq!(char_count_64_with_unicode.chars().count(), 64);
        match HashValidator::validate_sha256(&char_count_64_with_unicode) {
            Err(ValidationError::InvalidCharacter { position, character }) => {
                assert_eq!(position, 30);
                assert_eq!(character, '☃');
            }
            other => panic!("expected InvalidCharacter error, got {:?}", other),
        }

        // Binary null byte in 64-char string
        let with_null = format!("{}\0{}", "a".repeat(30), "b".repeat(33));
        match HashValidator::validate_sha256(&with_null) {
            Err(ValidationError::InvalidCharacter { position, character }) => {
                assert_eq!(position, 30);
                assert_eq!(character, '\0');
            }
            other => panic!("expected InvalidCharacter error for null byte, got {:?}", other),
        }
    }

    #[test]
    fn sha512_rejects_non_ascii_unicode_and_binary_characters() {
        // Unicode character (crab) embedded in 128-char string
        let with_unicode = format!("{}🦀{}", "a".repeat(60), "b".repeat(67));
        assert_eq!(with_unicode.chars().count(), 128);
        match HashValidator::validate_sha512(&with_unicode) {
            Err(ValidationError::InvalidCharacter { position, character }) => {
                assert_eq!(position, 60);
                assert_eq!(character, '🦀');
            }
            other => panic!("expected InvalidCharacter error, got {:?}", other),
        }

        // Binary null byte in 128-char string
        let with_null = format!("{}\0{}", "a".repeat(60), "b".repeat(67));
        match HashValidator::validate_sha512(&with_null) {
            Err(ValidationError::InvalidCharacter { position, character }) => {
                assert_eq!(position, 60);
                assert_eq!(character, '\0');
            }
            other => panic!("expected InvalidCharacter error for null byte, got {:?}", other),
        }
    }

    // ── Unexpected length tests for SHA-256 (too short / too long) ──────

    #[test]
    fn sha256_unexpected_length_too_short() {
        // Empty hash
        assert_eq!(HashValidator::validate_sha256(""), Err(ValidationError::EmptyHash));
        assert_eq!(HashValidator::validate_sha256("   "), Err(ValidationError::EmptyHash));

        // Various short lengths: 1, 10, 32, 63
        for len in [1, 10, 32, 63] {
            let short_hash = "a".repeat(len);
            assert_eq!(
                HashValidator::validate_sha256(&short_hash),
                Err(ValidationError::WrongLength {
                    expected: 64,
                    actual: len,
                }),
                "expected WrongLength for length {}",
                len
            );
        }
    }

    #[test]
    fn sha256_unexpected_length_too_long() {
        // Various long lengths: 65, 100, 128 (SHA-512 length), 256
        for len in [65, 100, 128, 256] {
            let long_hash = "a".repeat(len);
            assert_eq!(
                HashValidator::validate_sha256(&long_hash),
                Err(ValidationError::WrongLength {
                    expected: 64,
                    actual: len,
                }),
                "expected WrongLength for length {}",
                len
            );
        }
    }

    // ── Unexpected length tests for SHA-512 (too short / too long) ──────

    #[test]
    fn sha512_unexpected_length_too_short() {
        // Empty hash
        assert_eq!(HashValidator::validate_sha512(""), Err(ValidationError::EmptyHash));
        assert_eq!(HashValidator::validate_sha512("   "), Err(ValidationError::EmptyHash));

        // Various short lengths: 1, 32, 64 (SHA-256 length), 127
        for len in [1, 32, 64, 127] {
            let short_hash = "a".repeat(len);
            assert_eq!(
                HashValidator::validate_sha512(&short_hash),
                Err(ValidationError::WrongLength {
                    expected: 128,
                    actual: len,
                }),
                "expected WrongLength for length {}",
                len
            );
        }
    }

    #[test]
    fn sha512_unexpected_length_too_long() {
        // Various long lengths: 129, 150, 200, 256
        for len in [129, 150, 200, 256] {
            let long_hash = "a".repeat(len);
            assert_eq!(
                HashValidator::validate_sha512(&long_hash),
                Err(ValidationError::WrongLength {
                    expected: 128,
                    actual: len,
                }),
                "expected WrongLength for length {}",
                len
            );
        }
    }

    #[test]
    fn uppercase_hash_passes_after_normalization() {
        let upper = sample_sha256().to_uppercase();
        let normalized = HashValidator::normalize(&upper);
        assert!(HashValidator::validate_sha256(&normalized).is_ok());

        let upper_512 = sample_sha512().to_uppercase();
        let normalized_512 = HashValidator::normalize(&upper_512);
        assert!(HashValidator::validate_sha512(&normalized_512).is_ok());
    }

    #[test]
    fn invalid_character_reports_position() {
        let mut hash = sample_sha256().to_string();
        hash.replace_range(10..11, "g"); // 'g' is not a valid hex digit

        match HashValidator::validate_sha256(&hash) {
            Err(ValidationError::InvalidCharacter {
                position,
                character,
            }) => {
                assert_eq!(position, 10);
                assert_eq!(character, 'g');
            }
            other => panic!("expected InvalidCharacter error, got {:?}", other),
        }

        let mut hash512 = sample_sha512().to_string();
        hash512.replace_range(100..101, "z"); // 'z' is not a valid hex digit

        match HashValidator::validate_sha512(&hash512) {
            Err(ValidationError::InvalidCharacter {
                position,
                character,
            }) => {
                assert_eq!(position, 100);
                assert_eq!(character, 'z');
            }
            other => panic!("expected InvalidCharacter error, got {:?}", other),
        }
    }

    #[test]
    fn detect_algorithm_identifies_sha256() {
        let algo = HashValidator::detect_algorithm(sample_sha256());
        assert_eq!(algo, Some(HashAlgorithm::SHA256));
    }

    #[test]
    fn detect_algorithm_identifies_sha512() {
        let algo = HashValidator::detect_algorithm(sample_sha512());
        assert_eq!(algo, Some(HashAlgorithm::SHA512));
    }

    #[test]
    fn detect_algorithm_returns_none_for_other_lengths() {
        let algo = HashValidator::detect_algorithm("abc123");
        assert_eq!(algo, None);
        assert_eq!(HashValidator::detect_algorithm(""), None);
        assert_eq!(HashValidator::detect_algorithm(&"a".repeat(63)), None);
        assert_eq!(HashValidator::detect_algorithm(&"a".repeat(65)), None);
        assert_eq!(HashValidator::detect_algorithm(&"a".repeat(127)), None);
        assert_eq!(HashValidator::detect_algorithm(&"a".repeat(129)), None);
    }
}
