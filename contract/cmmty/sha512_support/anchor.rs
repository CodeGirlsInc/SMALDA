use super::validator::HashAlgo;

pub fn manage_data_key(hash: &str, algo: HashAlgo) -> String {
    match algo {
        HashAlgo::Sha256 => format!("doc_{}", &hash[..16]),
        HashAlgo::Sha512 => format!("doc512_{}", &hash[..16]),
    }
}