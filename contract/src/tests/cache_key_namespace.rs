//! Regression coverage for cache key namespacing by hash algorithm,
//! ensuring a SHA-256 and SHA-512 anchor sharing a prefix cannot collide.

#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy)]
pub enum HashAlgorithm {
    Sha256,
    Sha512,
}

pub fn build_cache_key(algorithm: HashAlgorithm, hash_hex: &str) -> String {
    let prefix = match algorithm {
        HashAlgorithm::Sha256 => "sha256",
        HashAlgorithm::Sha512 => "sha512",
    };
    format!("{prefix}:{hash_hex}")
}

#[test]
fn cache_keys_are_namespaced_by_algorithm() {
    let shared_value = "deadbeef";
    let sha256_key = build_cache_key(HashAlgorithm::Sha256, shared_value);
    let sha512_key = build_cache_key(HashAlgorithm::Sha512, shared_value);

    assert_ne!(sha256_key, sha512_key);
}
