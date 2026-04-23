pub enum HashAlgo {
    Sha256,
    Sha512,
}

pub fn detect_hash(hash: &str) -> Option<HashAlgo> {
    if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(HashAlgo::Sha256)
    } else if hash.len() == 128 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(HashAlgo::Sha512)
    } else {
        None
    }
}