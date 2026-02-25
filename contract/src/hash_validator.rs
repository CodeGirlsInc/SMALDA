#[derive(Debug)]
pub enum ValidationError {
    WrongLength { expected: usize, actual: usize },
    InvalidCharacter { position: usize, character: char },
    EmptyHash,
}

#[derive(Debug, PartialEq, Eq)]
pub enum HashAlgorithm {
    SHA256,
    SHA512,
}

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

    #[test]
    fn wrong_length_error_for_63_char_hash() {
        let hash = "a".repeat(63);
        match HashValidator::validate_sha256(&hash) {
            Err(ValidationError::WrongLength { expected, actual }) => {
                assert_eq!(expected, 64);
                assert_eq!(actual, 63);
            }
            other => panic!("expected WrongLength error, got {:?}", other),
        }
    }

    #[test]
    fn empty_hash_errors() {
        match HashValidator::validate_sha256("") {
            Err(ValidationError::EmptyHash) => {}
            other => panic!("expected EmptyHash error, got {:?}", other),
        }
    }

    #[test]
    fn uppercase_hash_passes_after_normalization() {
        let upper = sample_sha256().to_uppercase();
        let normalized = HashValidator::normalize(&upper);
        assert!(HashValidator::validate_sha256(&normalized).is_ok());
    }

    #[test]
    fn invalid_character_reports_position() {
        let mut hash = sample_sha256().to_string();
        hash.replace_range(10..11, "g"); // 'g' is not a valid hex digit

        match HashValidator::validate_sha256(&hash) {
            Err(ValidationError::InvalidCharacter { position, character }) => {
                assert_eq!(position, 10);
                assert_eq!(character, 'g');
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
    }
}

